"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

async function loadExtension(readText, { patchEnabled = false, codexExtension = null, globalStorageUri } = {}) {
  const handlers = new Map();
  const writes = [];
  const warnings = [];
  const updates = [];
  const information = [];
  const vscode = {
    env: { clipboard: { readText, writeText: async (text) => writes.push(text) } },
    commands: { registerCommand: (name, handler) => { handlers.set(name, handler); return {}; } },
    workspace: { getConfiguration: () => ({
      get: () => patchEnabled,
      update: async (...args) => updates.push(args),
    }) },
    ConfigurationTarget: { Global: 1 },
    window: {
      setStatusBarMessage() {},
      showWarningMessage: async (message) => warnings.push(message),
      showInformationMessage: async (message) => information.push(message),
      showErrorMessage: async (message) => { throw new Error(message); },
    },
    extensions: { getExtension: () => codexExtension },
  };
  const filename = path.join(__dirname, "..", "extension.js");
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    require: (name) => name === "vscode" ? vscode : localRequire(name),
    module,
    console: { error() {} },
  }, { filename });
  await module.exports.activate({ subscriptions: [], globalStorageUri });
  return { run: handlers.get("markdownCopyHelper.normalizeClipboardMath"), handlers, writes, warnings, updates, information };
}

test("portable clipboard conversion works without an installed Codex extension", async () => {
  const extension = await loadExtension(async () => String.raw`公式 \(x\)`);
  await extension.run();
  assert.deepEqual(extension.writes, ["公式 $x$"]);
});

test("automatic direct copy backs up patches and restore disables reapplication", async (t) => {
  const os = require("node:os");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-copy-extension-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const assets = path.join(directory, "webview", "assets");
  fs.mkdirSync(assets, { recursive: true });
  const file = path.join(assets, "renamed.js");
  const original = "function f(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=g(e,n);return r!=null&&(t.setData(`text/html`,r.htmlText),t.setData(`text/plain`,r.plainText),!0)}";
  fs.writeFileSync(file, original);
  const extension = await loadExtension(async () => "", {
    patchEnabled: true,
    codexExtension: { extensionPath: directory, packageJSON: { version: "test" } },
    globalStorageUri: { fsPath: path.join(directory, "storage") },
  });
  assert.match(fs.readFileSync(file, "utf8"), /__markdownCopyHelperNormalize/);
  assert.equal(fs.readFileSync(path.join(directory, "storage/backups/test/renamed.js"), "utf8"), original);
  assert.deepEqual(extension.writes, []); // Preserve the HTML clipboard; never use writeText here.
  await extension.handlers.get("markdownCopyHelper.restoreCodexMathCopy")();
  assert.equal(fs.readFileSync(file, "utf8"), original);
  assert.deepEqual(extension.updates, [["codexPatchEnabled", false, 1]]);
  await extension.handlers.get("markdownCopyHelper.enableCodexMathCopy")();
  assert.deepEqual(extension.updates[1], ["codexPatchEnabled", true, 1]);
});

test("leaves unchanged or newly copied clipboard content alone", async () => {
  const unchanged = await loadExtension(async () => "ordinary text");
  await unchanged.run();
  assert.deepEqual(unchanged.writes, []);
  let reads = 0;
  const raced = await loadExtension(async () => reads++ === 0 ? String.raw`\(x\)` : "new copy");
  await raced.run();
  assert.deepEqual(raced.writes, []);
  assert.equal(raced.warnings.length, 1);
});
