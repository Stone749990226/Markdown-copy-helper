"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const { patchMarkdownCopy } = require("./patcher");
const { findMarkdownBundle: locateMarkdownBundle } = require("./bundle-locator");
const { normalizeMarkdownMath } = require("./markdown-math");

const CODEX_EXTENSION_ID = "openai.chatgpt";

async function findMarkdownBundle(codexExtension) {
  const assetDirectory = path.join(
    codexExtension.extensionPath,
    "webview",
    "assets"
  );
  return locateMarkdownBundle(assetDirectory);
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

async function enableMarkdownMathCopy(context, { automatic = false } = {}) {
  const codexExtension = requireCodexExtension();
  const bundlePath = await findMarkdownBundle(codexExtension);
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

  if (!automatic) {
    await vscode.workspace.getConfiguration("markdownCopyHelper")
      .update("codexPatchEnabled", true, vscode.ConfigurationTarget.Global);
  }

  if (!automatic || result.changed) {
    const action = await vscode.window.showInformationMessage(
      result.changed
        ? "Codex math copy now uses $...$ and $$...$$. Reload VS Code to apply it."
        : "Codex math copy is already patched. Reload VS Code if it is still open.",
      "Reload VS Code"
    );
    if (action === "Reload VS Code") {
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  }

  return result;
}

async function restoreDefaultMathCopy(context) {
  const codexExtension = requireCodexExtension();
  const bundlePath = await findMarkdownBundle(codexExtension);
  const originalBackupPath = backupPath(context, codexExtension, bundlePath);

  if (!fs.existsSync(originalBackupPath)) {
    throw new Error(
      "No backup exists for this Codex version. Reinstalling Codex restores its default files."
    );
  }

  fs.copyFileSync(originalBackupPath, bundlePath);
  await vscode.workspace.getConfiguration("markdownCopyHelper")
    .update("codexPatchEnabled", false, vscode.ConfigurationTarget.Global);
  await vscode.window.showInformationMessage(
    "Restored Codex's default math copy behavior. Reload VS Code to apply it."
  );
}

async function normalizeClipboardMath() {
  const original = await vscode.env.clipboard.readText();
  const normalized = normalizeMarkdownMath(original);
  if (normalized === original) {
    vscode.window.setStatusBarMessage("剪贴板中没有需要转换的 LaTeX 公式。", 4000);
    return;
  }
  // A remote clipboard read can take time. Do not overwrite a newer copy.
  if (await vscode.env.clipboard.readText() !== original) {
    await vscode.window.showWarningMessage("剪贴板已变化，请重新运行公式转换。");
    return;
  }
  await vscode.env.clipboard.writeText(normalized);
  vscode.window.setStatusBarMessage("已将剪贴板公式转换为 Markdown，可直接粘贴。", 4000);
}

async function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "markdownCopyHelper.normalizeClipboardMath",
      async () => {
        try {
          await normalizeClipboardMath();
        } catch (error) {
          await vscode.window.showErrorMessage(`公式转换失败：${error.message}`);
        }
      }
    ),
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

  if (vscode.workspace.getConfiguration("markdownCopyHelper").get("codexPatchEnabled", true) &&
      vscode.extensions.getExtension(CODEX_EXTENSION_ID)) {
    try {
      await enableMarkdownMathCopy(context, { automatic: true });
    } catch (error) {
      console.error("Unable to patch Codex math copy automatically:", error);
      await vscode.window.showWarningMessage(
        `Codex 富文本公式复制未能启用：${error.message}。可运行 Markdown Copy Helper: Enable Codex Math Copy 重试。`
      );
    }
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
