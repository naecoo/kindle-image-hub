/* kindle-image-hub — i18n engine + manage-UI strings.
   Default language: English. Choice persists in localStorage. */

(function () {
    "use strict";

    var DICT = {
        en: {
            "app.title": "Image Manager",
            "nav.converter": "Open converter →",
            "tab.screensaver": "Screensaver",
            "tab.images": "Images",
            "toolbar.upload": "Upload images…",
            "toolbar.refresh": "Refresh",

            "status.loading": "Loading…",
            "status.count": "{n} image(s)",
            "status.deleted": "Deleted {name}",
            "status.uploading": "Uploading {i} / {n}…",
            "status.uploaded": "Uploaded {n} image(s).",
            "status.uploadFail": "Upload failed: {err}",
            "status.error": "Error: {err}",
            "hub.token": "This Image Hub requires an access code:",

            "card.download": "Download",
            "card.delete": "Delete",
            "card.confirm": "Delete {name}?",

            "empty.title": "No images in this folder",
            "empty.hint": "Use “Upload images…” from your computer, or send from the converter"
        },
        zh: {
            "app.title": "图片管理",
            "nav.converter": "打开转换器 →",
            "tab.screensaver": "屏保",
            "tab.images": "图片",
            "toolbar.upload": "上传图片…",
            "toolbar.refresh": "刷新",

            "status.loading": "加载中…",
            "status.count": "{n} 张图片",
            "status.deleted": "已删除 {name}",
            "status.uploading": "上传 {i} / {n}…",
            "status.uploaded": "上传完成（{n} 张）。",
            "status.uploadFail": "上传失败：{err}",
            "status.error": "错误：{err}",
            "hub.token": "该 Image Hub 设置了访问码，请输入：",

            "card.download": "下载",
            "card.delete": "删除",
            "card.confirm": "删除 {name}？",

            "empty.title": "这个文件夹还没有图片",
            "empty.hint": "点「上传图片…」从电脑添加，或在转换器里直传"
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
