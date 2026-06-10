/**
 * Mermaid theme — high-contrast palettes synced with html[data-theme].
 */
(function () {
  "use strict";

  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function isDark() {
    var mode = document.documentElement.dataset.theme || "auto";
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return media.matches;
  }

  function themeConfig(dark) {
    return {
      startOnLoad: true,
      theme: "base",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
      themeVariables: dark
        ? {
            fontSize: "17px",
            fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            darkMode: "true",
            background: "#1e293b",
            primaryColor: "#1d4ed8",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#93c5fd",
            secondaryColor: "#2563eb",
            secondaryTextColor: "#ffffff",
            secondaryBorderColor: "#93c5fd",
            tertiaryColor: "#3b82f6",
            tertiaryTextColor: "#ffffff",
            lineColor: "#cbd5e1",
            textColor: "#e2e8f0",
            mainBkg: "#1d4ed8",
            nodeBorder: "#93c5fd",
            nodeTextColor: "#ffffff",
            clusterBkg: "#0f172a",
            clusterBorder: "#64748b",
            titleColor: "#f8fafc",
            edgeLabelBackground: "#1e293b",
            labelTextColor: "#f8fafc",
            actorTextColor: "#f8fafc",
            signalTextColor: "#f8fafc",
            cScale0: "#1d4ed8",
            cScale1: "#2563eb",
            cScale2: "#3b82f6",
          }
        : {
            fontSize: "17px",
            fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            darkMode: "false",
            background: "#f8fafc",
            primaryColor: "#1d4ed8",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#1e40af",
            secondaryColor: "#2563eb",
            secondaryTextColor: "#ffffff",
            secondaryBorderColor: "#1e40af",
            tertiaryColor: "#3b82f6",
            tertiaryTextColor: "#ffffff",
            lineColor: "#475569",
            textColor: "#0f172a",
            mainBkg: "#1d4ed8",
            nodeBorder: "#1e40af",
            nodeTextColor: "#ffffff",
            clusterBkg: "#eff6ff",
            clusterBorder: "#93c5fd",
            titleColor: "#0f172a",
            edgeLabelBackground: "#ffffff",
            labelTextColor: "#0f172a",
            actorTextColor: "#0f172a",
            signalTextColor: "#0f172a",
            cScale0: "#1d4ed8",
            cScale1: "#2563eb",
            cScale2: "#3b82f6",
          },
    };
  }

  function initMermaid() {
    if (typeof mermaid === "undefined") return;
    mermaid.initialize(themeConfig(isDark()));
  }

  initMermaid();

  document.addEventListener("blog-theme-change", function () {
    initMermaid();
  });

  if (media.addEventListener) {
    media.addEventListener("change", function () {
      if ((document.documentElement.dataset.theme || "auto") === "auto") {
        initMermaid();
      }
    });
  }
})();
