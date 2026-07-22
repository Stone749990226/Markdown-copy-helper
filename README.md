# Markdown Copy Helper

This extension has two independent copy paths:

1. **Markdown Preview -> Feishu**
   - Preserves browser-native rich text: headings, lists, tables, code blocks,
     images, and alignment.
   - Replaces selected KaTeX/MathJax DOM with recoverable Markdown math:
     `$...$` or `$$...$$`.
   - Forces copied text to black for Feishu.

2. **Codex chat -> Markdown**
   - Patches the installed Codex Webview bundle so selected formulas and raw
     `\(...\)` / `\[...\]` source are copied as `$...$` / `$$...$$`.
   - Codex does not expose an API for another extension to intercept this
     Webview's copy event, so this path uses a version-checked local patch.

## Install

Package and install the extension:

```sh
npx @vscode/vsce package
code --install-extension markdown-copy-helper-1.0.3.vsix
```

The Feishu behavior works in VS Code's built-in Markdown Preview after
reloading the VS Code window.

For Codex chat, run `Markdown Copy Helper: Enable Codex Math Copy` from the
Command Palette and reload the VS Code window. Run `Markdown Copy Helper:
Restore Codex Math Copy` to restore Codex's original bundle.

## Limitations

- A Codex update replaces its bundled assets. Run the enable command again.
- The patch supports the Codex bundle shape available when this extension was
  written; it fails without changing files when that implementation changes.
- Codex's final clipboard normalization also rewrites `\(...\)` and `\[...\]`
  inside selected code samples.
- The Codex path normalizes both `text/html` and `text/plain`, because rich
  editors such as Feishu prefer HTML clipboard data.
