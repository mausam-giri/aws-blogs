(function () {
  const input = document.getElementById("json-tool-input");
  const output = document.getElementById("json-tool-output");
  const status = document.getElementById("json-tool-status");
  const issuesList = document.getElementById("json-tool-issues");

  if (!input || !output || !status) return;

  const AWS_IAM_KEYS = new Set([
    "Version",
    "Statement",
    "Id",
    "Sid",
    "Effect",
    "Action",
    "NotAction",
    "Resource",
    "NotResource",
    "Principal",
    "NotPrincipal",
    "Condition",
    "AWS",
    "Service",
    "Federated",
    "CanonicalUser",
  ]);

  function setStatus(type, message) {
    status.className = "json-tool__status json-tool__status--" + type;
    status.textContent = message;
  }

  function renderIssues(issues) {
    if (!issuesList) return;
    issuesList.innerHTML = "";
    if (!issues.length) {
      issuesList.parentElement.hidden = true;
      return;
    }
    issuesList.parentElement.hidden = false;
    issues.forEach(function (issue) {
      const li = document.createElement("li");
      li.textContent = issue;
      issuesList.appendChild(li);
    });
  }

  function parseJson(text) {
    return JSON.parse(text);
  }

  function lintAwsPolicy(data, issues) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      issues.push("Root value should be a JSON object for IAM policies.");
      return;
    }

    const keys = Object.keys(data);
    const unknown = keys.filter(function (k) {
      return !AWS_IAM_KEYS.has(k) && k !== "Policy" && k !== "PolicyName";
    });
    if (unknown.length) {
      issues.push("Uncommon top-level keys: " + unknown.join(", ") + ".");
    }

    if (!data.Version) {
      issues.push('Missing "Version" (expected "2012-10-17" for IAM).');
    } else if (data.Version !== "2012-10-17") {
      issues.push('Version is "' + data.Version + '"; IAM policies usually use "2012-10-17".');
    }

    let statements = data.Statement;
    if (!statements) {
      issues.push('Missing "Statement" array.');
      return;
    }

    if (!Array.isArray(statements)) {
      issues.push('"Statement" should be an array (wrap a single statement in [ ]).');
      statements = [statements];
    }

    if (!statements.length) {
      issues.push('"Statement" array is empty.');
    }

    statements.forEach(function (stmt, index) {
      const label = "Statement[" + index + "]";
      if (!stmt || typeof stmt !== "object" || Array.isArray(stmt)) {
        issues.push(label + " must be an object.");
        return;
      }

      if (!stmt.Effect) {
        issues.push(label + ' missing "Effect" (Allow or Deny).');
      } else if (stmt.Effect !== "Allow" && stmt.Effect !== "Deny") {
        issues.push(label + ' Effect must be "Allow" or "Deny".');
      }

      const hasAction = "Action" in stmt || "NotAction" in stmt;
      const hasResource = "Resource" in stmt || "NotResource" in stmt;
      const hasPrincipal = "Principal" in stmt || "NotPrincipal" in stmt;

      if (!hasAction && !hasPrincipal) {
        issues.push(label + " should define Action/NotAction or Principal (trust policy).");
      }

      if (!hasResource && !hasPrincipal) {
        issues.push(label + " should define Resource/NotResource for identity policies.");
      }

      if (stmt.Action === "*" || stmt.Action === ["*"]) {
        issues.push(label + ' uses Action "*" — prefer least-privilege actions.');
      }

      if (stmt.Resource === "*" || stmt.Resource === ["*"]) {
        issues.push(label + ' uses Resource "*" — confirm scope is intentional.');
      }

      if (stmt.Principal === "*" || stmt.Principal === { AWS: "*" }) {
        issues.push(label + ' allows Principal "*" — high risk for trust/resource policies.');
      }

      if (stmt.Condition && typeof stmt.Condition !== "object") {
        issues.push(label + " Condition must be an object.");
      }
    });
  }

  function lintGeneric(data, issues) {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if ("Statement" in data || "Version" in data || "Principal" in data) {
        lintAwsPolicy(data, issues);
      }
    }
  }

  function beautify() {
    try {
      const parsed = parseJson(input.value.trim());
      const formatted = JSON.stringify(parsed, null, 2);
      output.value = formatted;
      input.value = formatted;

      const issues = [];
      lintGeneric(parsed, issues);

      if (issues.length) {
        setStatus("warn", "Valid JSON — review AWS policy warnings below.");
        renderIssues(issues);
      } else {
        setStatus("ok", "Valid JSON. Formatted successfully.");
        renderIssues([]);
      }
    } catch (err) {
      output.value = "";
      setStatus("error", "Invalid JSON: " + err.message);
      renderIssues([]);
    }
  }

  function lintOnly() {
    try {
      const parsed = parseJson(input.value.trim());
      const issues = [];
      lintGeneric(parsed, issues);

      if (issues.length) {
        setStatus("warn", "Valid JSON with " + issues.length + " lint note(s).");
        renderIssues(issues);
      } else {
        setStatus("ok", "Valid JSON. No AWS policy issues detected.");
        renderIssues([]);
      }
    } catch (err) {
      setStatus("error", "Invalid JSON: " + err.message);
      renderIssues([]);
    }
  }

  function minify() {
    try {
      const parsed = parseJson(input.value.trim());
      const minified = JSON.stringify(parsed);
      output.value = minified;
      setStatus("ok", "Minified successfully.");
      renderIssues([]);
    } catch (err) {
      setStatus("error", "Invalid JSON: " + err.message);
      renderIssues([]);
    }
  }

  function copyOutput() {
    navigator.clipboard.writeText(output.value || input.value).then(function () {
      setStatus("ok", "Copied to clipboard.");
    });
  }

  function clearAll() {
    input.value = "";
    output.value = "";
    setStatus("ok", "Cleared.");
    renderIssues([]);
  }

  document.getElementById("json-tool-beautify")?.addEventListener("click", beautify);
  document.getElementById("json-tool-lint")?.addEventListener("click", lintOnly);
  document.getElementById("json-tool-minify")?.addEventListener("click", minify);
  document.getElementById("json-tool-copy")?.addEventListener("click", copyOutput);
  document.getElementById("json-tool-clear")?.addEventListener("click", clearAll);
})();
