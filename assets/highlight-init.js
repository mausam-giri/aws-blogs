/**
 * Client-side syntax highlighting (highlight.js + Tokyo Night theme).
 * Runs before code-block toolbar enhancement.
 */
(function () {
  "use strict";

  if (typeof hljs === "undefined") return;

  var SKIP = ".mermaid, .json-tool, [data-no-highlight]";
  var ALIASES = {
    docker: "dockerfile",
    sh: "bash",
    shell: "bash",
    yml: "yaml",
    py: "python",
    js: "javascript",
    ts: "typescript",
    tf: "plaintext",
    hcl: "plaintext",
    terraform: "plaintext",
  };

  function normalizeLang(code) {
    var match = code.className.match(/language-([\w+#.-]+)/);
    if (!match) return;
    var lang = match[1].toLowerCase();
    var mapped = ALIASES[lang];
    if (!mapped) return;
    code.classList.remove("language-" + lang);
    code.classList.add("language-" + mapped);
    code.setAttribute("data-lang", mapped);
  }

  function highlightAll() {
    var root = document.querySelector("article.markdown");
    if (!root) return;

    root.querySelectorAll("pre code").forEach(function (code) {
      if (code.closest(SKIP)) return;
      if (code.classList.contains("hljs")) return;
      normalizeLang(code);
      hljs.highlightElement(code);
    });
  }

  highlightAll();
  window.__hljsReady = true;
  document.dispatchEvent(new CustomEvent("hljs-ready"));
})();
