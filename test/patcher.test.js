"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  COPY_FUNCTION_REPLACEMENT,
  COPY_FUNCTION_SOURCE,
  COPY_HANDLER_ANCHOR,
  normalizeMathDelimiters,
  patchMarkdownCopy,
  supportsMarkdownCopyPatch,
} = require("../patcher");
const { selectPatchableMarkdownBundle } = require("../bundle-locator");

function copyBundle(patched = false) {
  return `${COPY_HANDLER_ANCHOR} ${
    patched ? COPY_FUNCTION_REPLACEMENT : COPY_FUNCTION_SOURCE
  }`;
}

test("patches the final HTML and plain-text Codex copy path", () => {
  const source = copyBundle();
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, true);
  assert.equal(result.status, "patched");
  assert.equal(result.source.includes(COPY_FUNCTION_REPLACEMENT), true);
  assert.equal(result.source.includes(COPY_FUNCTION_SOURCE), false);
});

test("normalizes multiple inline and display formulas in one selection", () => {
  const copiedText = String.raw`before \[ a=b \] middle \( c=d \) after \[ e=f \]`;

  assert.equal(
    normalizeMathDelimiters(copiedText),
    "before $$a=b$$ middle $c=d$ after $$e=f$$"
  );
});

test("does not modify an already patched bundle", () => {
  const source = copyBundle(true);
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, false);
  assert.equal(result.status, "already-patched");
  assert.equal(result.source, source);
});

test("rejects a bundle without the current Codex copy implementation", () => {
  assert.equal(supportsMarkdownCopyPatch(COPY_FUNCTION_SOURCE), false);
  assert.throws(() => patchMarkdownCopy(COPY_FUNCTION_SOURCE), /does not match/);
});

test("contributes the Feishu copy script to Markdown Preview", () => {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scriptPath = path.join(__dirname, "..", "media", "copy-feishu.js");

  assert.deepEqual(packageJson.contributes["markdown.previewScripts"], [
    "./media/copy-feishu.js",
  ]);
  assert.equal(fs.existsSync(scriptPath), true);
});

test("activates automatically and retains its commands", () => {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  assert.equal(packageJson.name, "markdown-copy-helper");
  assert.equal(packageJson.version, "1.2.0");
  assert.deepEqual(packageJson.activationEvents, [
    "onStartupFinished",
    "onCommand:markdownCopyHelper.enableCodexMathCopy",
    "onCommand:markdownCopyHelper.restoreCodexMathCopy",
  ]);
});

test("selects the only current Codex bundle that supports the patch", () => {
  const bundleName = selectPatchableMarkdownBundle([
    { name: "app-initial-a.js", source: "unrelated" },
    { name: "app-initial-b.js", source: copyBundle() },
  ]);

  assert.equal(bundleName, "app-initial-b.js");
  assert.equal(supportsMarkdownCopyPatch(copyBundle()), true);
});

test("rejects ambiguous or unsupported bundle sets", () => {
  const source = copyBundle();

  assert.throws(
    () =>
      selectPatchableMarkdownBundle([
        { name: "app-initial-a.js", source },
        { name: "app-initial-b.js", source },
      ]),
    /found 2 among 2/
  );
  assert.throws(
    () => selectPatchableMarkdownBundle([{ name: "app-initial-a.js", source: "" }]),
    /found 0 among 1/
  );
});
