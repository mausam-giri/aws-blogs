(function () {
  "use strict";

  var STORAGE_KEY = "blog-theme";
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "auto";
    } catch (err) {
      return "auto";
    }
  }

  function resolvedIsDark(mode) {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return media.matches;
  }

  function updateMetaThemeColor(mode) {
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    var dark = resolvedIsDark(mode);
    meta.setAttribute("content", dark ? "#0b1120" : "#eef2f7");
  }

  function syncPressed(mode) {
    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-theme-set") === mode ? "true" : "false");
    });
    document.dispatchEvent(new CustomEvent("blog-theme-change", { detail: { mode: mode } }));
  }

  function applyTheme(mode, persist) {
    root.dataset.theme = mode;
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (err) {
        /* ignore */
      }
    }
    updateMetaThemeColor(mode);
    syncPressed(mode);
  }

  document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyTheme(btn.getAttribute("data-theme-set"));
    });
  });

  if (media.addEventListener) {
    media.addEventListener("change", function () {
      if (readStored() === "auto") updateMetaThemeColor("auto");
    });
  }

  applyTheme(readStored(), false);
})();
