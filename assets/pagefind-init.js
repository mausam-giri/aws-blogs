(function () {
  "use strict";

  function isEditableTarget(target) {
    if (!target || target === document.body) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function resolvedDark() {
    const mode = document.documentElement.dataset.theme || "auto";
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncPagefindTheme() {
    const theme = resolvedDark() ? "dark" : "light";
    const modal = document.querySelector("pagefind-modal");
    if (modal) modal.setAttribute("data-pf-theme", theme);
  }

  function getModal() {
    return document.querySelector("pagefind-modal");
  }

  function openSearch() {
    const modal = getModal();
    if (modal && typeof modal.open === "function") {
      syncPagefindTheme();
      modal.open();
      return;
    }
    const trigger = document.querySelector("pagefind-modal-trigger");
    if (trigger && typeof trigger.click === "function") trigger.click();
  }

  document.querySelectorAll(".pagefind-trigger").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      openSearch();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && !isEditableTarget(document.activeElement)) {
      event.preventDefault();
      openSearch();
    }
  });

  syncPagefindTheme();

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if ((document.documentElement.dataset.theme || "auto") === "auto") syncPagefindTheme();
    });
  }

  document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.setTimeout(syncPagefindTheme, 0);
    });
  });

  document.addEventListener("blog-theme-change", syncPagefindTheme);
})();
