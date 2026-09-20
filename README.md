# Markdown Copy Helper

This extension has two independent copy paths:

1. **Markdown Preview -> Feishu**
   - Preserves browser-native rich text: headings, lists, tables, code blocks,
     images, and alignment.
   - Replaces selected KaTeX/MathJax DOM with recoverable Markdown math:
     `$...$` or `$$...$$`.
   - Forces copied text to black for Feishu.

2. **Codex chat -> Markdown**
   - Patches the installed Codex Webview bundle so selected formulas are
     copied as `$...$` / `$$...$$` in both HTML and plain-text clipboard data.
   - Codex does not expose an API for another extension to intercept this
     Webview's copy event, so this path uses a version-checked local patch.

## Install

Package and install the extension:

```sh
code --install-extension markdown-copy-helper-1.2.0.vsix
```

The Feishu behavior works in VS Code's built-in Markdown Preview after
reloading the VS Code window.

For Codex chat, the extension enables the patch automatically at startup and
offers to reload VS Code after the first change. `Markdown Copy Helper: Enable
Codex Math Copy` can reapply the patch after a Codex update. `Markdown Copy
Helper: Restore Codex Math Copy` restores Codex's original bundle.

## Limitations

- The Codex path is verified against Codex `26.5908.31748`. A Codex update can
  replace its bundled assets; run the enable command again after updating.
- If Codex changes its copy implementation, the command fails without changing
  its files.
