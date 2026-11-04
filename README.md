# Markdown Copy Helper

## Codex → 飞书（默认）

在 Codex 中选中内容，直接 `Ctrl+C`，到飞书正常粘贴。
复制数据保留 Codex 输出的 HTML 富文本（标题、粗体、链接、列表、表格、代码块），
并在 HTML 和纯文本中将公式转换为 `$...$` / `$$...$$`。
公式以 LaTeX 文本保留；是否自动变成飞书原生公式取决于飞书的粘贴处理。

安装后运行一次 `Developer: Reload Window`。
插件默认在启动时检查 Codex 并应用补丁；如果提示补丁发生变化，需要再次重载窗口。
也可手动运行 `Markdown Copy Helper: Enable Codex Math Copy`。

旧版失效的原因是 Codex 将复制模块从 `app-initial-*.js` 拆到了 `copy-*.js`。
现在按代码内容定位，不绑定文件名；但仍依赖 Codex 的内部复制实现，
不能保证以后所有版本都无需适配。不支持的实现不会被修改，并会显示提示。

补丁应用前会备份原脚本。
`Markdown Copy Helper: Restore Codex Math Copy` 恢复当前版本备份并关闭自动修补。
手动启用命令会重新开启自动修补。设置项：`markdownCopyHelper.codexPatchEnabled`。

已在当前安装的 Codex `26.1021.22027` 真实复制模块上进行浏览器验证：
HTML 与纯文本同时写入，标题、列表、表格、链接、代码块及行内/块公式保留。
尚未在飞书客户端验证最终粘贴效果。

## Markdown 预览 → 飞书

VS Code 内置 Markdown 预览中正常复制，会保留浏览器富文本，
将可识别的 KaTeX/MathJax 公式替换成 Markdown 公式，并将文字设为黑色。
这是独立于 Codex 的功能。

## 额外的纯文本转换工具

`Ctrl+Alt+M`（macOS：`Cmd+Alt+M`）或命令
`Markdown Copy Helper: 将剪贴板公式转为 Markdown` 可转换剪贴板中的 LaTeX 分隔符。
这个工具不依赖 Codex，但输出纯文本，会丢失 HTML 富文本；粘贴飞书时无需运行它。
如果来源只提供图片或显示字符，无法还原公式。

## 安装与测试

```sh
code --install-extension markdown-copy-helper-1.4.1.vsix --force
# 安装后运行 Developer: Reload Window
npm test
```

打包：`npx @vscode/vsce package --allow-missing-repository`。
