/**
 * Mermaid theme — high-contrast palettes for light and dark (prefers-color-scheme).
 */
(function () {
  "use strict";

  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  function themeConfig(isDark) {
    return {
      startOnLoad: true,
      theme: "base",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
      themeVariables: isDark
        ? {
            fontSize: "17px",
            fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            darkMode: "true",
            background: "#1a2332",
            primaryColor: "#2b5a8c",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#7eb8e8",
            secondaryColor: "#3d5a73",
            secondaryTextColor: "#ffffff",
            secondaryBorderColor: "#9ec3e6",
            tertiaryColor: "#1e3a52",
            tertiaryTextColor: "#ffffff",
            lineColor: "#c8d6e5",
            textColor: "#f2f4f8",
            mainBkg: "#2b5a8c",
            nodeBorder: "#7eb8e8",
            nodeTextColor: "#ffffff",
            clusterBkg: "#243044",
            clusterBorder: "#6b9cc4",
            titleColor: "#ffffff",
            edgeLabelBackground: "#1a2332",
            labelTextColor: "#f2f4f8",
            actorTextColor: "#f2f4f8",
            signalTextColor: "#f2f4f8",
            cScale0: "#2b5a8c",
            cScale1: "#3d6b8c",
            cScale2: "#4a7a9c",
          }
        : {
            fontSize: "17px",
            fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            darkMode: "false",
            background: "#f4f7fb",
            primaryColor: "#d6e8f7",
            primaryTextColor: "#121212",
            primaryBorderColor: "#0047a3",
            secondaryColor: "#c5daf0",
            secondaryTextColor: "#121212",
            secondaryBorderColor: "#0047a3",
            tertiaryColor: "#eaf2fa",
            tertiaryTextColor: "#121212",
            lineColor: "#3b4248",
            textColor: "#121212",
            mainBkg: "#d6e8f7",
            nodeBorder: "#0047a3",
            nodeTextColor: "#121212",
            clusterBkg: "#eef3f9",
            clusterBorder: "#5c636a",
            titleColor: "#121212",
            edgeLabelBackground: "#ffffff",
            labelTextColor: "#121212",
          },
    };
  }

  if (typeof mermaid !== "undefined") {
    mermaid.initialize(themeConfig(mq.matches));
  }
})();
