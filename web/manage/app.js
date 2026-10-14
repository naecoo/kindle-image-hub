/* kindle-image-hub — manage UI logic (i18n via window.I18N) */

(function () {
    "use strict";

    var t = window.I18N.t;

    var state = {
        dir: "screensaver",
        files: [],
        token: "",
        statusMsg: null             // { key, vars, cls } — re-rendered on lang change
    };

    function $(id) { return document.getElementById(id); }

    function setStatus(key, vars, cls) {
        state.statusMsg = { key: key, vars: vars, cls: cls || "" };
        var el = $("status");
        el.textContent = t(key, vars);
        el.className = "status " + (cls || "");
    }

    function api(path, options) {
        var sep = path.indexOf("?") === -1 ? "?" : "&";
        var url = path + sep + "token=" + encodeURIComponent(state.token);
        return fetch(url, options).then(function (resp) {
            if (resp.status === 401) {
                var tok = window.prompt(t("hub.token"));
                if (tok !== null) {
                    state.token = tok;
                    try { localStorage.setItem("picd.token", tok); } catch (e) { /* ignore */ }
                    return api(path, options);
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

    function fileUrl(name) {
        return "/api/download?dir=" + encodeURIComponent(state.dir) +
            "&name=" + encodeURIComponent(name) +
            "&token=" + encodeURIComponent(state.token);
    }

    function humanSize(n) {
        if (n < 1024) return n + " B";
        if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
        return (n / 1024 / 1024).toFixed(1) + " MB";
    }

    function load() {
        setStatus("status.loading");
        return api("/api/images?dir=" + encodeURIComponent(state.dir))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                state.files = data.files || [];
                render();
                setStatus("status.count", { n: state.files.length }, "ok");
            })
            .catch(function (err) {
                setStatus("status.error", { err: err.message }, "err");
            });
    }

    function render() {
        var grid = $("grid");
        var empty = $("empty");
        grid.innerHTML = "";

        if (!state.files.length) {
            grid.className = "grid hidden";
            empty.className = "empty";
            return;
        }
        grid.className = "grid";
        empty.className = "empty hidden";

        state.files.forEach(function (f) {
            var card = document.createElement("div");
            card.className = "card";

            var thumb = document.createElement("div");
            thumb.className = "thumb";
            var img = document.createElement("img");
            img.loading = "lazy";
            img.src = fileUrl(f.name);
            img.alt = f.name;
            thumb.appendChild(img);

            var meta = document.createElement("div");
            meta.className = "meta";
            var strong = document.createElement("strong");
            strong.textContent = f.name;
            var sub = document.createElement("span");
            sub.textContent = humanSize(f.size);
            meta.appendChild(strong);
            meta.appendChild(sub);

            var ops = document.createElement("div");
            ops.className = "ops";

            var dl = document.createElement("a");
            dl.textContent = t("card.download");
            dl.href = fileUrl(f.name);
            dl.setAttribute("download", f.name);

            var del = document.createElement("button");
            del.type = "button";
            del.className = "danger";
            del.textContent = t("card.delete");
            del.onclick = function () {
                if (!window.confirm(t("card.confirm", { name: f.name }))) return;
                api("/api/images?dir=" + encodeURIComponent(state.dir) +
                    "&name=" + encodeURIComponent(f.name),
                    { method: "DELETE" })
                    .then(function () {
                        setStatus("status.deleted", { name: f.name }, "ok");
                        return load();
                    })
                    .catch(function (err) {
                        setStatus("status.uploadFail", { err: err.message }, "err");
                    });
            };

            ops.appendChild(dl);
            ops.appendChild(del);
            card.appendChild(thumb);
            card.appendChild(meta);
            card.appendChild(ops);
            grid.appendChild(card);
        });
    }

    function uploadFiles(fileList) {
        if (!fileList || !fileList.length) return;
        var files = [];
        for (var i = 0; i < fileList.length; i++) files.push(fileList[i]);

        setStatus("status.uploading", { i: 0, n: files.length });
        files.reduce(function (chain, file, idx) {
            return chain.then(function () {
                var fd = new FormData();
                fd.append("file", file, file.name);
                fd.append("dir", state.dir);
                return api("/api/upload?dir=" + encodeURIComponent(state.dir), {
                    method: "POST",
                    body: fd
                });
            }).then(function () {
                setStatus("status.uploading", { i: idx + 1, n: files.length });
            });
        }, Promise.resolve()).then(function () {
            setStatus("status.uploaded", { n: files.length }, "ok");
            return load();
        }).catch(function (err) {
            setStatus("status.uploadFail", { err: err.message }, "err");
        });
    }

    function init() {
        try { state.token = localStorage.getItem("picd.token") || ""; } catch (e) { /* ignore */ }

        $("host-label").textContent = location.host;

        window.I18N.onLangChange(function () {
            render();
            if (state.statusMsg) {
                var el = $("status");
                el.textContent = t(state.statusMsg.key, state.statusMsg.vars);
                el.className = "status " + (state.statusMsg.cls || "");
            }
        });

        $("tabs").onclick = function (e) {
            var el = e.target;
            if (!el.getAttribute || !el.getAttribute("data-dir")) return;
            state.dir = el.getAttribute("data-dir");
            var btns = $("tabs").getElementsByTagName("button");
            for (var i = 0; i < btns.length; i++) {
                btns[i].className = (btns[i] === el) ? "on" : "";
            }
            load();
        };

        $("upload-btn").onclick = function () { $("upload-input").click(); };
        $("upload-input").onchange = function () {
            uploadFiles(this.files);
            this.value = "";
        };
        $("refresh-btn").onclick = load;

        // deep link: /?dir=images
        var m = /[?&]dir=([^&]+)/.exec(location.search);
        if (m && m[1] === "images") {
            var btns = $("tabs").getElementsByTagName("button");
            for (var i = 0; i < btns.length; i++) {
                var on = btns[i].getAttribute("data-dir") === "images";
                btns[i].className = on ? "on" : "";
                if (on) state.dir = "images";
            }
        }

        load();
    }

    document.addEventListener("DOMContentLoaded", init);
})();
