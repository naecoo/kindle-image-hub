/* kindle-image-hub — i18n engine + converter strings.
   Default language: English. Choice persists in localStorage. */

(function () {
    "use strict";

    var DICT = {
        en: {
            "app.title": "Image Converter",
            "lang.en": "EN",
            "lang.zh": "中文",

            "hub.label": "Direct to Kindle",
            "hub.connect": "Connect",
            "hub.disconnect": "Disconnect",
            "hub.offline": "Offline",
            "hub.connecting": "Connecting…",
            "hub.connected": "Connected",
            "hub.failed": "Connection failed",
            "hub.enterUrl": "Enter a hub URL",
            "hub.token": "This Image Hub requires an access code:",

            "target.device": "Target device",
            "target.size": "Target size",
            "target.w": "W",
            "target.h": "H",
            "orient.portrait": "Portrait",
            "orient.landscape": "Landscape",

            "out.title": "Output",
            "out.gray": "Grayscale PNG · for screensavers",
            "out.color": "Color PNG",
            "out.jpeg": "JPEG",
            "out.dither": "e-ink tuned (16-level + dither)",
            "out.quality": "Quality",
            "out.cover": "Fill & crop (screensaver)",
            "out.contain": "Fit with padding",
            "out.ssNaming": "Screensaver naming (bg_ss00.png …)",

            "img.title": "Images",
            "img.pick": "Choose images…",
            "img.dropHint": "or drag & drop onto the right side",

            "batch.title": "Batch",
            "batch.dlAll": "Download all",
            "batch.upAll": "Send all",

            "drop.title": "Drop images here",
            "drop.sub": "Conversion runs locally in your browser — nothing is uploaded to any server",

            "card.download": "Download",
            "card.send": "Send",
            "card.sent": "Sent ✓",

            "msg.converting": "Converting {i} / {n}…",
            "msg.done": "Done: {n} image(s).",
            "msg.doneConnected": "Done: {n} image(s) — ready to send.",
            "msg.noImages": "No image files found.",
            "msg.sizeErr": "Set a valid target size first.",
            "msg.encodeErr": "Image encoding failed.",
            "msg.decodeErr": "Cannot decode image: {name}",
            "msg.dlTriggered": "Triggered {n} download(s) — the browser may ask for multi-file permission.",
            "msg.upNone": "Nothing to send.",
            "msg.upProg": "Sending {i} / {n}…",
            "msg.upDone": "All sent ({n}) → screensaver folder.",
            "msg.upFail": "Send failed: {err}",
            "msg.upInterrupted": "Send stopped: {err}",
            "msg.ready": "Ready to send to Kindle.",
            "msg.hubError": "Hub error: {err}",
            "msg.error": "Error: {err}"
        },
        zh: {
            "app.title": "图片转换器",
            "lang.en": "EN",
            "lang.zh": "中文",

            "hub.label": "直传 Kindle",
            "hub.connect": "连接",
            "hub.disconnect": "断开",
            "hub.offline": "未连接",
            "hub.connecting": "连接中…",
            "hub.connected": "已连接",
            "hub.failed": "连接失败",
            "hub.enterUrl": "请输入地址",
            "hub.token": "该 Image Hub 设置了访问码，请输入：",

            "target.device": "目标设备",
            "target.size": "目标尺寸",
            "target.w": "宽",
            "target.h": "高",
            "orient.portrait": "竖版",
            "orient.landscape": "横版",

            "out.title": "输出",
            "out.gray": "灰度 PNG · 屏保推荐",
            "out.color": "彩色 PNG",
            "out.jpeg": "JPEG",
            "out.dither": "e-ink 优化（16 级灰度 + 抖动）",
            "out.quality": "质量",
            "out.cover": "填满裁剪（屏保）",
            "out.contain": "完整适配（白边）",
            "out.ssNaming": "屏保命名（bg_ss00.png 起）",

            "img.title": "图片",
            "img.pick": "选择图片…",
            "img.dropHint": "或直接拖拽到右侧区域",

            "batch.title": "批量",
            "batch.dlAll": "全部下载",
            "batch.upAll": "全部直传",

            "drop.title": "拖拽图片到这里",
            "drop.sub": "转换在浏览器本地完成，不会上传到任何服务器",

            "card.download": "下载",
            "card.send": "直传",
            "card.sent": "已直传 ✓",

            "msg.converting": "正在转换 {i} / {n}…",
            "msg.done": "完成：共 {n} 张。",
            "msg.doneConnected": "完成：共 {n} 张，可一键直传。",
            "msg.noImages": "没有可处理的图片文件。",
            "msg.sizeErr": "请先设置有效的目标尺寸。",
            "msg.encodeErr": "图片编码失败。",
            "msg.decodeErr": "无法解码图片：{name}",
            "msg.dlTriggered": "已触发 {n} 个下载（浏览器可能询问是否允许多文件下载）。",
            "msg.upNone": "没有待直传的图片。",
            "msg.upProg": "正在直传 {i} / {n}…",
            "msg.upDone": "全部直传完成（{n} 张，已存入 screensaver）。",
            "msg.upFail": "直传失败：{err}",
            "msg.upInterrupted": "直传中断：{err}",
            "msg.ready": "可直传到 Kindle。",
            "msg.hubError": "服务错误：{err}",
            "msg.error": "错误：{err}"
        }
    };

    var listeners = [];
    var lang = "en";
    try {
        var saved = window.localStorage.getItem("kih.lang");
        if (saved === "zh" || saved === "en") lang = saved;
    } catch (e) { /* storage unavailable: stay English */ }

    function t(key, vars) {
        var table = DICT[lang] || DICT.en;
        var s = table[key];
        if (s === undefined) s = DICT.en[key];
        if (s === undefined) return key;
        if (vars) {
            for (var k in vars) {
                if (Object.prototype.hasOwnProperty.call(vars, k)) {
                    s = s.split("{" + k + "}").join(vars[k]);
                }
            }
        }
        return s;
    }

    function applyStatic() {
        var nodes = document.querySelectorAll("[data-i18n]");
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
        }
        var phs = document.querySelectorAll("[data-i18n-ph]");
        for (var j = 0; j < phs.length; j++) {
            phs[j].setAttribute("placeholder", t(phs[j].getAttribute("data-i18n-ph")));
        }
        document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
        var btns = document.querySelectorAll("[data-lang]");
        for (var b = 0; b < btns.length; b++) {
            btns[b].className = (btns[b].getAttribute("data-lang") === lang) ? "on" : "";
        }
    }

    function setLang(l) {
        if (l !== "en" && l !== "zh") return;
        lang = l;
        try { window.localStorage.setItem("kih.lang", l); } catch (e) { /* ignore */ }
        applyStatic();
        for (var i = 0; i < listeners.length; i++) listeners[i]();
    }

    function onLangChange(fn) { listeners.push(fn); }

    function initToggle() {
        var wrap = document.getElementById("lang-toggle");
        if (!wrap) return;
        wrap.onclick = function (e) {
            var el = e.target;
            while (el && el !== wrap && !el.getAttribute("data-lang")) el = el.parentNode;
            if (el && el !== wrap) setLang(el.getAttribute("data-lang"));
        };
    }

    document.addEventListener("DOMContentLoaded", function () {
        applyStatic();
        initToggle();
    });

    window.I18N = {
        t: t,
        setLang: setLang,
        getLang: function () { return lang; },
        onLangChange: onLangChange,
        applyStatic: applyStatic
    };
})();
