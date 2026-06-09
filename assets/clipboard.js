/**
 * Code block enhancements — copy, soft-wrap, language badge.
 * Small self-contained module; no external dependencies.
 */
(function () {
  "use strict";

  var SKIP_SELECTOR = ".json-tool, .mermaid, .katex, [data-no-codeblock]";

  var icons = {
    copy:
      '<svg class="codeblock-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    check:
      '<svg class="codeblock-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    wrap:
      '<svg class="codeblock-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 19h6v-2H4v2zm0-6h10v-2H4v2zm0-4v2h14V5H4zm14 8h-4v2h6v-6h-2v4z"/></svg>',
  };

  var Lang = {
    from: function (root) {
      var code = root.querySelector("code");
      if (!code) return "text";
      var match = code.className.match(/language-([\w+#.-]+)/);
      if (match) return match[1];
      return code.getAttribute("data-lang") || "text";
    },
    label: function (lang) {
      var aliases = {
        bash: "Bash",
        sh: "Shell",
        shell: "Shell",
        powershell: "PowerShell",
        ps1: "PowerShell",
        yaml: "YAML",
        yml: "YAML",
        json: "JSON",
        javascript: "JavaScript",
        js: "JavaScript",
        typescript: "TypeScript",
        ts: "TypeScript",
        python: "Python",
        py: "Python",
        dockerfile: "Dockerfile",
        docker: "Dockerfile",
        hcl: "HCL",
        terraform: "HCL",
        sql: "SQL",
        go: "Go",
        rust: "Rust",
        ini: "INI",
        toml: "TOML",
        xml: "XML",
        html: "HTML",
        css: "CSS",
        text: "Plain text",
        plaintext: "Plain text",
        fallback: "Plain text",
      };
      return aliases[lang.toLowerCase()] || lang;
    },
  };

  var Clipboard = {
    text: function (pre) {
      var code = pre.querySelector("code");
      return (code ? code.textContent : pre.textContent).trimEnd();
    },
    write: async function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    },
  };

  var Toolbar = {
    create: function (lang) {
      var bar = document.createElement("div");
      bar.className = "codeblock-toolbar";

      var langEl = document.createElement("span");
      langEl.className = "codeblock-lang";
      langEl.textContent = Lang.label(lang);
      langEl.title = "Language: " + lang;

      var wrapLabel = document.createElement("label");
      wrapLabel.className = "codeblock-wrap-toggle";
      wrapLabel.title = "Toggle soft wrap";
      wrapLabel.innerHTML =
        '<input type="checkbox" class="codeblock-wrap-input" aria-label="Toggle soft wrap" />' +
        icons.wrap;

      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "codeblock-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy code to clipboard");
      copyBtn.innerHTML = icons.copy;

      bar.appendChild(langEl);
      bar.appendChild(wrapLabel);
      bar.appendChild(copyBtn);

      return { bar: bar, wrapInput: wrapLabel.querySelector("input"), copyBtn: copyBtn };
    },
  };

  var Codeblock = {
    shouldSkip: function (node) {
      return !!node.closest(SKIP_SELECTOR);
    },

    shell: function (node) {
      if (node.classList.contains("highlight")) return node;
      if (node.tagName === "PRE") {
        var shell = document.createElement("div");
        shell.className = "highlight codeblock codeblock--plain";
        node.parentNode.insertBefore(shell, node);
        shell.appendChild(node);
        return shell;
      }
      return null;
    },

    enhance: function (node) {
      if (node.dataset.codeblockEnhanced === "true") return;
      if (Codeblock.shouldSkip(node)) return;

      var pre = node.tagName === "PRE" ? node : node.querySelector("pre");
      if (!pre) return;

      var shell = Codeblock.shell(node);
      if (!shell) return;

      shell.dataset.codeblockEnhanced = "true";
      shell.classList.add("codeblock");

      var lang = Lang.from(shell);
      var ui = Toolbar.create(lang);
      shell.insertBefore(ui.bar, shell.firstChild);

      ui.wrapInput.addEventListener("change", function () {
        shell.classList.toggle("codeblock--wrap", ui.wrapInput.checked);
      });

      ui.copyBtn.addEventListener("click", async function () {
        try {
          await Clipboard.write(Clipboard.text(pre));
          ui.copyBtn.classList.add("codeblock-copy-btn--success");
          ui.copyBtn.innerHTML = icons.check;
        } catch (err) {
          ui.copyBtn.classList.add("codeblock-copy-btn--error");
        }

        window.setTimeout(function () {
          ui.copyBtn.classList.remove(
            "codeblock-copy-btn--success",
            "codeblock-copy-btn--error"
          );
          ui.copyBtn.innerHTML = icons.copy;
        }, 2000);
      });
    },

    init: function () {
      var root = document.querySelector("article.markdown");
      if (!root) return;

      root.querySelectorAll(".highlight").forEach(Codeblock.enhance);

      root.querySelectorAll("pre").forEach(function (pre) {
        if (!pre.querySelector("code")) return;
        if (pre.closest(".highlight")) return;
        Codeblock.enhance(pre);
      });
    },
  };

  function scheduleInit() {
    if (window.__hljsReady) {
      Codeblock.init();
      return;
    }
    document.addEventListener(
      "hljs-ready",
      function () {
        Codeblock.init();
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInit);
  } else {
    scheduleInit();
  }
})();
