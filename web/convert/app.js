/* kindle-image-hub — converter app logic (i18n via window.I18N) */

(function () {
    "use strict";

    var t = window.I18N.t;

    /* ------------------------------------------------------------ state */

    var state = {
        profile: KINDLE_PROFILES[0],
        orientation: "portrait",   // portrait | landscape
        format: "gray",            // gray | color | jpeg
        fit: "cover",              // cover | contain
        dither: true,
        quality: 90,
        ssNaming: true,
        results: [],               // { outName, blob, url, srcName, w, h, sent }
        hubUrl: "",
        hubToken: "",
        hubState: "offline",       // offline | connecting | online | failed
        hubErr: "",
        ssSeq: 0,
        batchMsg: null             // { key, vars } — re-rendered on lang change
    };

    var forceStored = /[?&]rawpng=1/.test(location.search);

    /* ------------------------------------------------------------- utils */

    function $(id) { return document.getElementById(id); }

    function targetSize() {
        var w, h;
        if (state.profile.id === "custom") {
            w = parseInt($("custom-w").value, 10);
            h = parseInt($("custom-h").value, 10);
            if (!w || !h || w < 1 || h < 1) return null;
        } else {
            w = state.profile.w;
            h = state.profile.h;
        }
        if (state.orientation === "landscape") {
            return { w: Math.max(w, h), h: Math.min(w, h) };
        }
        return { w: Math.min(w, h), h: Math.max(w, h) };
    }

    function extFor(fmt) { return fmt === "jpeg" ? "jpg" : "png"; }

    function baseName(name) {
        var i = name.lastIndexOf(".");
        return i > 0 ? name.substring(0, i) : name;
    }

    function pad2(n) { return (n < 10 ? "0" : "") + n; }

    function setBatch(key, vars) {
        state.batchMsg = { key: key, vars: vars };
        $("batch-status").textContent = t(key, vars);
    }

    function renderHubStatus() {
        var el = $("hub-status");
        var cls = "status ";
        var text;
        if (state.hubState === "online") { cls += "on"; text = t("hub.connected"); }
        else if (state.hubState === "connecting") { cls += "off"; text = t("hub.connecting"); }
        else if (state.hubState === "failed") { cls += "err"; text = t("hub.failed"); }
        else { cls += "off"; text = t("hub.offline"); }
        el.textContent = text;
        el.className = cls;
        $("hub-connect").textContent = state.hubState === "online"
            ? t("hub.disconnect") : t("hub.connect");
    }

    /* -------------------------------------------------------- conversion */

    function loadBitmap(file) {
        if (window.createImageBitmap) {
            try {
                return createImageBitmap(file, { imageOrientation: "from-image" })
                    .catch(function () { return createImageBitmap(file); });
            } catch (e) { /* older signature */ }
        }
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error(t("msg.decodeErr", { name: file.name })));
            };
            img.src = url;
        });
    }

    function drawToCanvas(bitmap, tw, th, fit) {
        var sw = bitmap.width;
        var sh = bitmap.height;
        var canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tw, th);

        if (fit === "cover") {
            var scale = Math.max(tw / sw, th / sh);
            var cw = tw / scale;
            var ch = th / scale;
            var sx = (sw - cw) / 2;
            var sy = (sh - ch) / 2;
            ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, tw, th);
        } else {
            var s = Math.min(tw / sw, th / sh);
            var dw = Math.round(sw * s);
            var dh = Math.round(sh * s);
            ctx.drawImage(bitmap, Math.round((tw - dw) / 2), Math.round((th - dh) / 2), dw, dh);
        }
        return canvas;
    }

    var BAYER4 = [
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5
    ];

    function toGrayBuffer(imageData, useDither) {
        var d = imageData.data;
        var w = imageData.width;
        var h = imageData.height;
        var out = new Uint8Array(w * h);
        var levels = 16;
        var step = 255 / (levels - 1);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var i = (y * w + x) * 4;
                var a = d[i + 3] / 255;
                var r = d[i] * a + 255 * (1 - a);
                var g = d[i + 1] * a + 255 * (1 - a);
                var b = d[i + 2] * a + 255 * (1 - a);
                var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                if (useDither) {
                    var bias = ((BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5) * step;
                    lum = Math.round((lum + bias) / step) * step;
                    if (lum < 0) lum = 0;
                    if (lum > 255) lum = 255;
                }
                out[y * w + x] = lum | 0;
            }
        }
        return out;
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error(t("msg.encodeErr")));
            }, type, quality);
        });
    }

    function convertFile(file, meta) {
        var size = targetSize();
        if (!size) return Promise.reject(new Error(t("msg.sizeErr")));

        return loadBitmap(file).then(function (bitmap) {
            var canvas = drawToCanvas(bitmap, size.w, size.h, state.fit);
            if (bitmap.close) bitmap.close();

            if (state.format === "gray") {
                var ctx = canvas.getContext("2d", { willReadFrequently: true });
                var img = ctx.getImageData(0, 0, size.w, size.h);
                var gray = toGrayBuffer(img, state.dither);
                var encoder = forceStored ? window.encodeGrayPNGStored : window.encodeGrayPNG;
                return encoder(size.w, size.h, gray);
            }
            if (state.format === "jpeg") {
                return canvasToBlob(canvas, "image/jpeg", state.quality / 100);
            }
            return canvasToBlob(canvas, "image/png");
        }).then(function (blob) {
            return {
                srcName: file.name,
                outName: meta.outName,
                blob: blob,
                url: URL.createObjectURL(blob),
                w: size.w,
                h: size.h,
                sent: false
            };
        });
    }

    function nextOutName(srcFile) {
        if (state.ssNaming && state.format === "gray") {
            var name = "bg_ss" + pad2(state.ssSeq) + "." + extFor(state.format);
            state.ssSeq = (state.ssSeq + 1) % 100;
            return name;
        }
        return baseName(srcFile.name) + "_" + targetSize().w + "x" + targetSize().h +
            "." + extFor(state.format);
    }

    /* -------------------------------------------------------- results UI */

    function renderResults() {
        var results = $("results");
        var drop = $("dropzone");
        if (!state.results.length) {
            results.className = "hidden";
            drop.className = "";
            $("dl-all").disabled = true;
            $("upload-all").disabled = true;
            return;
        }
        drop.className = "hidden";
        results.className = "";

        results.innerHTML = "";
        state.results.forEach(function (r) {
            var card = document.createElement("div");
            card.className = "card";

            var thumb = document.createElement("div");
            thumb.className = "thumb";
            var img = document.createElement("img");
            img.src = r.url;
            img.alt = r.outName;
            thumb.appendChild(img);

            var meta = document.createElement("div");
            meta.className = "meta";
            var out = document.createElement("span");
            out.className = "out";
            out.textContent = r.outName;
            var sub = document.createElement("span");
            sub.textContent = r.srcName + " · " + r.w + "×" + r.h + " · " +
                Math.max(1, Math.round(r.blob.size / 1024)) + " KB";
            meta.appendChild(out);
            meta.appendChild(sub);

            var ops = document.createElement("div");
            ops.className = "ops";

            var dl = document.createElement("button");
            dl.type = "button";
            dl.textContent = t("card.download");
            dl.onclick = function () { downloadOne(r); };

            var up = document.createElement("button");
            up.type = "button";
            up.className = r.sent ? "sent" : "";
            up.textContent = r.sent ? t("card.sent") : t("card.send");
            up.disabled = state.hubState !== "online";
            up.onclick = function () {
                uploadOne(r).then(function () {
                    renderResults();
                }).catch(function (err) {
                    setBatch("msg.upFail", { err: err.message });
                });
            };

            ops.appendChild(dl);
            ops.appendChild(up);
            card.appendChild(thumb);
            card.appendChild(meta);
            card.appendChild(ops);
            results.appendChild(card);
        });

        $("dl-all").disabled = false;
        $("upload-all").disabled = state.hubState !== "online";
    }

    function downloadOne(r) {
        var a = document.createElement("a");
        a.href = r.url;
        a.download = r.outName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /* ----------------------------------------------------- hub (picd) */

    function hubApi(path, options) {
        var base = state.hubUrl.replace(/\/+$/, "");
        var sep = path.indexOf("?") === -1 ? "?" : "&";
        var url = base + path + sep + "token=" + encodeURIComponent(state.hubToken || "");
        return fetch(url, options).then(function (resp) {
            if (resp.status === 401) {
                var tok = window.prompt(t("hub.token"));
                if (tok !== null) {
                    state.hubToken = tok;
                    return hubApi(path, options);
                }
            }
            if (!resp.ok) {
                return resp.text().then(function (body) {
                    var msg = body;
                    try { msg = JSON.parse(body).error || body; } catch (e) { /* plain */ }
                    throw new Error(msg || ("HTTP " + resp.status));
                });
            }
            return resp;
        });
    }

    function connectHub() {
        var url = $("hub-url").value.replace(/^\s+|\s+$/g, "");
        if (!url) {
            state.hubState = "failed";
            renderHubStatus();
            setBatch("msg.hubError", { err: t("hub.enterUrl") });
            return;
        }
        if (!/^https?:\/\//.test(url)) url = "http://" + url;
        state.hubUrl = url;
        state.hubState = "connecting";
        renderHubStatus();

        hubApi("/api/config").then(function () {
            state.hubState = "online";
            renderHubStatus();
            setBatch("msg.ready");
            renderResults();
        }).catch(function (err) {
            state.hubState = "failed";
            state.hubErr = err.message;
            renderHubStatus();
            setBatch("msg.hubError", { err: err.message });
            renderResults();
        });
    }

    function disconnectHub() {
        state.hubState = "offline";
        state.hubUrl = "";
        state.hubErr = "";
        renderHubStatus();
        renderResults();
    }

    function uploadOne(r) {
        var fd = new FormData();
        fd.append("file", r.blob, r.outName);
        fd.append("dir", "screensaver");
        return hubApi("/api/upload", { method: "POST", body: fd })
            .then(function (resp) { return resp.json(); })
            .then(function () { r.sent = true; });
    }

    function uploadAll() {
        var pending = state.results.filter(function (r) { return !r.sent; });
        if (!pending.length) {
            setBatch("msg.upNone");
            return;
        }
        setBatch("msg.upProg", { i: 0, n: pending.length });
        var done = 0;
        pending.reduce(function (chain, r) {
            return chain.then(function () {
                return uploadOne(r);
            }).then(function () {
                done++;
                setBatch("msg.upProg", { i: done, n: pending.length });
            });
        }, Promise.resolve()).then(function () {
            setBatch("msg.upDone", { n: pending.length });
            renderResults();
        }).catch(function (err) {
            setBatch("msg.upInterrupted", { err: err.message });
            renderResults();
        });
    }

    /* -------------------------------------------------------- intake */

    function handleFiles(fileList) {
        var files = [];
        for (var i = 0; i < fileList.length; i++) {
            if (fileList[i].type && fileList[i].type.indexOf("image/") === 0) {
                files.push(fileList[i]);
            }
        }
        if (!files.length) {
            setBatch("msg.noImages");
            return;
        }
        setBatch("msg.converting", { i: 0, n: files.length });

        files.reduce(function (chain, file, idx) {
            return chain.then(function () {
                var meta = { outName: nextOutName(file) };
                return convertFile(file, meta).then(function (r) {
                    state.results.push(r);
                    setBatch("msg.converting", { i: idx + 1, n: files.length });
                    renderResults();
                }).catch(function (err) {
                    setBatch("msg.error", { err: err.message });
                });
            });
        }, Promise.resolve()).then(function () {
            var key = state.hubState === "online" ? "msg.doneConnected" : "msg.done";
            setBatch(key, { n: state.results.length });
        });
    }

    /* ------------------------------------------------------- wiring */

    function refreshTarget() {
        var size = targetSize();
        $("target-size").textContent = size ? (size.w + " × " + size.h) : "—";
    }

    function syncFormatUI() {
        var gray = state.format === "gray";
        var jpeg = state.format === "jpeg";
        $("dither-wrap").style.display = gray ? "" : "none";
        $("quality-wrap").className = jpeg ? "row" : "row hidden";
        $("ss-naming").disabled = !gray;
    }

    function buildProfileSelect() {
        var sel = $("profile");
        KINDLE_PROFILES.forEach(function (p) {
            var opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            sel.appendChild(opt);
        });
        sel.onchange = function () {
            var id = sel.value;
            state.profile = KINDLE_PROFILES.filter(function (p) { return p.id === id; })[0];
            $("custom-size").className = (id === "custom") ? "row" : "row hidden";
            refreshTarget();
        };
    }

    function init() {
        buildProfileSelect();
        state.profile = KINDLE_PROFILES[0];
        refreshTarget();
        syncFormatUI();
        renderHubStatus();

        // language switch re-renders everything dynamic
        window.I18N.onLangChange(function () {
            renderHubStatus();
            renderResults();
            if (state.batchMsg) {
                $("batch-status").textContent =
                    t(state.batchMsg.key, state.batchMsg.vars);
            }
        });

        // orientation
        $("orientation").onclick = function (e) {
            var t2 = e.target;
            if (!t2.getAttribute || !t2.getAttribute("data-orient")) return;
            state.orientation = t2.getAttribute("data-orient");
            var btns = $("orientation").getElementsByTagName("button");
            for (var i = 0; i < btns.length; i++) {
                btns[i].className = (btns[i] === t2) ? "on" : "";
            }
            refreshTarget();
        };

        $("custom-w").onchange = refreshTarget;
        $("custom-h").onchange = refreshTarget;

        // format / fit / flags
        var radios = document.getElementsByName("fmt");
        for (var i = 0; i < radios.length; i++) {
            radios[i].onchange = function () {
                state.format = this.value;
                syncFormatUI();
                if (state.format !== "gray") state.ssSeq = 0;
            };
        }
        var fits = document.getElementsByName("fit");
        for (var j = 0; j < fits.length; j++) {
            fits[j].onchange = function () { state.fit = this.value; };
        }
        $("dither").onchange = function () { state.dither = this.checked; };
        $("quality").oninput = function () {
            state.quality = parseInt(this.value, 10);
            $("quality-val").textContent = this.value;
        };
        $("ss-naming").onchange = function () { state.ssNaming = this.checked; };

        // files
        $("pick-btn").onclick = function () { $("file-input").click(); };
        $("file-input").onchange = function () {
            handleFiles(this.files);
            this.value = "";
        };

        var dz = $("dropzone");
        var resultsWrap = $("results-wrap");
        ["dragenter", "dragover"].forEach(function (ev) {
            resultsWrap.addEventListener(ev, function (e) {
                e.preventDefault();
                dz.className = "drag";
            });
        });
        ["dragleave", "drop"].forEach(function (ev) {
            resultsWrap.addEventListener(ev, function (e) {
                e.preventDefault();
                if (ev === "drop" && e.dataTransfer && e.dataTransfer.files) {
                    handleFiles(e.dataTransfer.files);
                }
                if ($("results").className === "hidden") dz.className = "";
                else dz.className = "hidden";
            });
        });

        // batch
        $("dl-all").onclick = function () {
            state.results.forEach(function (r, i) {
                window.setTimeout(function () { downloadOne(r); }, i * 300);
            });
            setBatch("msg.dlTriggered", { n: state.results.length });
        };
        $("upload-all").onclick = uploadAll;

        // hub
        $("hub-connect").onclick = function () {
            if (state.hubState === "online") disconnectHub();
            else connectHub();
        };
        $("hub-url").onkeydown = function (e) {
            if (e.key === "Enter") connectHub();
        };

        // deep-link: ?hub=http://ip:8642
        var m = /[?&]hub=([^&]+)/.exec(location.search);
        if (m) {
            try { $("hub-url").value = decodeURIComponent(m[1]); } catch (e) { /* ignore */ }
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
