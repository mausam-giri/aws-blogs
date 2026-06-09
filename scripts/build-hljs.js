/**
 * Bundle highlight.js (common languages + dockerfile) for Hugo assets/.
 * Run: node scripts/build-hljs.js
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const entry = path.join(__dirname, "hljs-entry.js");
const outfile = path.join(__dirname, "..", "assets", "highlight.min.js");

const entrySource = `"use strict";
const hljs = require("highlight.js/lib/common");
hljs.registerLanguage("dockerfile", require("highlight.js/lib/languages/dockerfile"));
module.exports = hljs;
`;

fs.writeFileSync(entry, entrySource, "utf8");

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "hljs",
    outfile,
    platform: "browser",
    target: ["es2018"],
  })
  .then(() => {
    fs.unlinkSync(entry);
    const size = fs.statSync(outfile).size;
    console.log("Wrote " + outfile + " (" + Math.round(size / 1024) + " KB)");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
