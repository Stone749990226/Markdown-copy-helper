"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");
const {
  normalizeMathDelimiters,
  patchMarkdownCopy,
  supportsMarkdownCopyPatch,
} = require("../patcher");
const { findMarkdownBundle, selectPatchableMarkdownBundle } = require("../bundle-locator");

const OLD_COPY = "function vZt(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=gZt(e,n);return r==null?!1:(t.setData(`text/html`,r.htmlText),t.setData(`text/plain`,r.plainText),!0)}";
const GUARDED_COPY = "function f(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=g(e,n);if(r==null)return!1;return t.setData(`text/html`,r.htmlText),t.setData(`text/plain`,r.plainText),!0}";
const NEW_COPY = "function Ayt(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=Dyt(e,n);return r!=null&&(t.setData(`text/html`,r.htmlText),t.setData(`text/plain`,r.plainText),!0)}";

function runCopy(source, functionName, extractorName, copied) {
  const clipboard = new Map();
  const context = {
    [extractorName]: () => copied,
  };
  const copy = vm.runInNewContext(`${source};${functionName}`, context);
  const result = copy(
    { ownerDocument: { getSelection: () => ({}) } },
    { setData: (type, value) => clipboard.set(type, value) }
  );
  return { result, clipboard };
}

for (const [label, original, functionName, extractorName] of [
  ["old Codex", OLD_COPY, "vZt", "gZt"],
  ["guarded Codex", GUARDED_COPY, "f", "g"],
  ["new Codex", NEW_COPY, "Ayt", "Dyt"],
]) {
  test(`patches ${label} HTML and plain-text copy`, () => {
    const source = `before;${original};after;`;
    const patched = patchMarkdownCopy(source);

    assert.equal(patched.changed, true);
    assert.equal(patched.status, "patched");
    assert.equal(patched.source.startsWith("before;"), true);
    assert.equal(patched.source.endsWith(";after;"), true);
    assert.equal(supportsMarkdownCopyPatch(patched.source), true);

    const { result, clipboard } = runCopy(
      patched.source.slice("before;".length, -";after;".length),
      functionName,
      extractorName,
      {
        htmlText: String.raw`<p>\( a=b \) and \[ c=d \]</p>`,
        plainText: String.raw`\( a=b \) and \[ c=d \]`,
      }
    );
    assert.equal(result, true);
    assert.equal(clipboard.get("text/html"), "<p>$a=b$ and $$c=d$$</p>");
    assert.equal(clipboard.get("text/plain"), "$a=b$ and $$c=d$$");

    const secondRun = patchMarkdownCopy(patched.source);
    assert.equal(secondRun.changed, false);
    assert.equal(secondRun.source, patched.source);
  });

  test(`${label} leaves an empty selection uncopied`, () => {
    const patched = patchMarkdownCopy(original);
    const { result, clipboard } = runCopy(
      patched.source,
      functionName,
      extractorName,
      null
    );
    assert.equal(result, false);
    assert.equal(clipboard.size, 0);
  });
}

test("normalizes multiple inline and display formulas in one selection", () => {
  const copiedText = String.raw`before \[ a=b \] middle \( c=d \) after \[ e=f \]`;
  assert.equal(
    normalizeMathDelimiters(copiedText),
    "before $$a=b$$ middle $c=d$ after $$e=f$$"
  );
});

test("rejects unsupported and ambiguous copy implementations", () => {
  assert.equal(supportsMarkdownCopyPatch("unrelated"), false);
  assert.equal(supportsMarkdownCopyPatch(`${NEW_COPY}${NEW_COPY}`), false);
  assert.throws(() => patchMarkdownCopy("unrelated"), /does not match/);
  assert.throws(() => patchMarkdownCopy(`${NEW_COPY}${NEW_COPY}`), /does not match/);
});

test("recognizes the patch produced by the previous release", () => {
  const legacy = 'function vZt(e,t,n=e.ownerDocument.getSelection()){t.setData("text/html",i(r.htmlText)),t.setData("text/plain",i(r.plainText))}';
  assert.equal(supportsMarkdownCopyPatch(legacy), true);
  assert.equal(patchMarkdownCopy(legacy).changed, false);
});

test("selects the only patchable Codex bundle", () => {
  const bundleName = selectPatchableMarkdownBundle([
    { name: "app-initial-a.js", source: "unrelated" },
    { name: "app-initial-b.js", source: NEW_COPY },
  ]);
  assert.equal(bundleName, "app-initial-b.js");
});

test("rejects ambiguous or unsupported bundle sets", () => {
  assert.throws(
    () => selectPatchableMarkdownBundle([
      { name: "app-initial-a.js", source: OLD_COPY },
      { name: "app-initial-b.js", source: NEW_COPY },
    ]),
    /found 2 among 2/
  );
  assert.throws(
    () => selectPatchableMarkdownBundle([{ name: "app-initial-a.js", source: "" }]),
    /found 0 among 1/
  );
});

test("locates split or renamed copy chunks by content and rejects ambiguity", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-copy-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "app-initial-new.js"), "unrelated");
  fs.writeFileSync(path.join(directory, "arbitrary-copy-chunk.js"), NEW_COPY);
  const bundle = await findMarkdownBundle(directory);
  assert.equal(bundle, path.join(directory, "arbitrary-copy-chunk.js"));
  fs.writeFileSync(bundle, patchMarkdownCopy(NEW_COPY).source);
  assert.equal(await findMarkdownBundle(directory), bundle);
  fs.writeFileSync(path.join(directory, "another.js"), OLD_COPY);
  await assert.rejects(findMarkdownBundle(directory), /found 2/);
});

test("contributes the Feishu copy script to Markdown Preview", () => {
  const packageJson = require("../package.json");
  const scriptPath = path.join(__dirname, "..", "media", "copy-feishu.js");
  assert.deepEqual(packageJson.contributes["markdown.previewScripts"], [
    "./media/copy-feishu.js",
  ]);
  assert.equal(fs.existsSync(scriptPath), true);
});

test("activates automatically and retains its commands", () => {
  const packageJson = require("../package.json");
  assert.equal(packageJson.name, "markdown-copy-helper");
  assert.equal(packageJson.contributes.configuration.properties["markdownCopyHelper.codexPatchEnabled"].default, true);
  assert.deepEqual(packageJson.activationEvents, [
    "onStartupFinished",
    "onCommand:markdownCopyHelper.enableCodexMathCopy",
    "onCommand:markdownCopyHelper.restoreCodexMathCopy",
    "onCommand:markdownCopyHelper.normalizeClipboardMath",
  ]);
});
