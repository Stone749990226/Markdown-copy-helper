"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CLIPBOARD_REPLACEMENT,
  CLIPBOARD_SOURCE,
  DISPLAY_REPLACEMENT,
  DISPLAY_SOURCE,
  INLINE_REPLACEMENT,
  INLINE_SOURCE,
  LEGACY_CLIPBOARD_REPLACEMENT,
  normalizeMathDelimiters,
  patchMarkdownCopy,
  PREVIOUS_CLIPBOARD_REPLACEMENT,
  supportsMarkdownCopyPatch,
} = require("../patcher");
const { selectPatchableMarkdownBundle } = require("../bundle-locator");

test("converts Codex's selection-copy delimiters to Markdown delimiters", () => {
  const source = `before ${INLINE_SOURCE} middle ${DISPLAY_SOURCE} then ${CLIPBOARD_SOURCE} after`;
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, true);
  assert.equal(result.status, "patched");
  assert.equal(result.source.includes(INLINE_SOURCE), true);
  assert.equal(result.source.includes(DISPLAY_SOURCE), true);
  assert.equal(result.source.includes(CLIPBOARD_REPLACEMENT), true);
  assert.equal(result.source.includes(INLINE_REPLACEMENT), false);
  assert.equal(result.source.includes(DISPLAY_REPLACEMENT), false);
  assert.equal(result.source.includes(CLIPBOARD_SOURCE), false);
});

test("does not modify an already patched bundle", () => {
  const source = `before ${INLINE_SOURCE} middle ${DISPLAY_SOURCE} then ${CLIPBOARD_REPLACEMENT} after`;
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, false);
  assert.equal(result.status, "already-patched");
  assert.equal(result.source, source);
});

test("upgrades a bundle patched by version 0.1", () => {
  const source = `before ${INLINE_REPLACEMENT} middle ${DISPLAY_REPLACEMENT} then ${LEGACY_CLIPBOARD_REPLACEMENT} after`;
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, true);
  assert.equal(result.source.includes(CLIPBOARD_REPLACEMENT), true);
  assert.equal(result.source.includes(INLINE_SOURCE), true);
  assert.equal(result.source.includes(DISPLAY_SOURCE), true);
  assert.equal(result.source.includes(INLINE_REPLACEMENT), false);
  assert.equal(result.source.includes(DISPLAY_REPLACEMENT), false);
});

test("upgrades a bundle patched by version 1.0.2", () => {
  const source = `before ${INLINE_SOURCE} middle ${DISPLAY_SOURCE} then ${PREVIOUS_CLIPBOARD_REPLACEMENT} after`;
  const result = patchMarkdownCopy(source);

  assert.equal(result.changed, true);
  assert.equal(result.source.includes(CLIPBOARD_REPLACEMENT), true);
  assert.equal(result.source.includes(PREVIOUS_CLIPBOARD_REPLACEMENT), false);
});

test("normalizes raw inline and display LaTeX delimiters", () => {
  const copiedText = String.raw`inline \(Y=XW\), display \[
\operatorname{softmax}(x)
\]`;

  assert.equal(
    normalizeMathDelimiters(copiedText),
    "inline $Y=XW$, display $$\\operatorname{softmax}(x)$$"
  );
});

test("uses the same Markdown math delimiters for HTML clipboard content", () => {
  const copiedHtml = String.raw`<p>inline \($Y=XW$\)</p><p>\[$$A=B$$\]</p>`;

  assert.equal(
    normalizeMathDelimiters(copiedHtml),
    "<p>inline $Y=XW$</p><p>$$A=B$$</p>"
  );
});

test("keeps exactly one inline delimiter pair and two display delimiter pairs", () => {
  const copiedText = String.raw`\($Y=XW$\), \($$A=B$$\), \[$Y=XW$\], \[$$A=B$$\]`;

  assert.equal(
    normalizeMathDelimiters(copiedText),
    "$Y=XW$, $A=B$, $$Y=XW$$, $$A=B$$"
  );
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

test("uses the Markdown Copy Helper extension identity", () => {
  const packagePath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  assert.equal(packageJson.name, "markdown-copy-helper");
  assert.equal(packageJson.displayName, "Markdown Copy Helper");
  assert.deepEqual(packageJson.activationEvents, [
    "onCommand:markdownCopyHelper.enableCodexMathCopy",
    "onCommand:markdownCopyHelper.restoreCodexMathCopy",
  ]);
});

test("selects the only Markdown bundle that supports the copy patch", () => {
  const patchableSource = `${INLINE_SOURCE} ${DISPLAY_SOURCE} ${CLIPBOARD_SOURCE}`;
  const bundleName = selectPatchableMarkdownBundle([
    { name: "markdown-surface.js", source: "unrelated" },
    { name: "markdown-renderer.js", source: "also unrelated" },
    { name: "markdown-copy.js", source: patchableSource },
  ]);

  assert.equal(bundleName, "markdown-copy.js");
  assert.equal(supportsMarkdownCopyPatch(patchableSource), true);
  assert.equal(supportsMarkdownCopyPatch("unrelated"), false);
});

test("rejects ambiguous or unsupported Markdown bundle sets", () => {
  const patchableSource = `${INLINE_SOURCE} ${DISPLAY_SOURCE} ${CLIPBOARD_SOURCE}`;

  assert.throws(
    () =>
      selectPatchableMarkdownBundle([
        { name: "markdown-a.js", source: patchableSource },
        { name: "markdown-b.js", source: patchableSource },
      ]),
    /found 2 among 2/
  );
  assert.throws(
    () => selectPatchableMarkdownBundle([{ name: "markdown-a.js", source: "" }]),
    /found 0 among 1/
  );
});
