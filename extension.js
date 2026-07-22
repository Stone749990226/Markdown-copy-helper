"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const { patchMarkdownCopy } = require("./patcher");
const { selectPatchableMarkdownBundle } = require("./bundle-locator");

const CODEX_EXTENSION_ID = "openai.chatgpt";

function findMarkdownBundle(codexExtension) {
  const assetDirectory = path.join(
    codexExtension.extensionPath,
    "webview",
    "assets"
  );
  const candidates = fs
    .readdirSync(assetDirectory)
    .filter((name) => /^markdown-.*\.js$/.test(name));
  const bundleName = selectPatchableMarkdownBundle(
    candidates.map((name) => ({
      name,
      source: fs.readFileSync(path.join(assetDirectory, name), "utf8"),
    }))
  );

  return path.join(assetDirectory, bundleName);
}

function backupPath(context, codexExtension, bundlePath) {
  const version = codexExtension.packageJSON.version;
  return path.join(
    context.globalStorageUri.fsPath,
    "backups",
    version,
    path.basename(bundlePath)
  );
}

function requireCodexExtension() {
  const codexExtension = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
  if (codexExtension == null) {
    throw new Error("The OpenAI Codex extension (openai.chatgpt) is not installed.");
  }
  return codexExtension;
}

async function enableMarkdownMathCopy(context) {
  const codexExtension = requireCodexExtension();
  const bundlePath = findMarkdownBundle(codexExtension);
  const originalSource = fs.readFileSync(bundlePath, "utf8");
  const result = patchMarkdownCopy(originalSource);

  if (result.changed) {
    const originalBackupPath = backupPath(context, codexExtension, bundlePath);
    fs.mkdirSync(path.dirname(originalBackupPath), { recursive: true });
    if (!fs.existsSync(originalBackupPath)) {
      fs.copyFileSync(bundlePath, originalBackupPath);
    }
    fs.writeFileSync(bundlePath, result.source, "utf8");
  }

  await vscode.window.showInformationMessage(
    result.changed
      ? "Codex math copy now uses $...$ and $$...$$. Reload VS Code to apply it."
      : "Codex math copy is already patched. Reload VS Code if it is still open."
  );
}

async function restoreDefaultMathCopy(context) {
  const codexExtension = requireCodexExtension();
  const bundlePath = findMarkdownBundle(codexExtension);
  const originalBackupPath = backupPath(context, codexExtension, bundlePath);

  if (!fs.existsSync(originalBackupPath)) {
    throw new Error(
      "No backup exists for this Codex version. Reinstalling Codex restores its default files."
    );
  }

  fs.copyFileSync(originalBackupPath, bundlePath);
  await vscode.window.showInformationMessage(
    "Restored Codex's default math copy behavior. Reload VS Code to apply it."
  );
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "markdownCopyHelper.enableCodexMathCopy",
      async () => {
        try {
          await enableMarkdownMathCopy(context);
        } catch (error) {
          await vscode.window.showErrorMessage(
            `Unable to patch Codex math copy: ${error.message}`
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      "markdownCopyHelper.restoreCodexMathCopy",
      async () => {
        try {
          await restoreDefaultMathCopy(context);
        } catch (error) {
          await vscode.window.showErrorMessage(
            `Unable to restore Codex math copy: ${error.message}`
          );
        }
      }
    )
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
