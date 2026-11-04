"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMarkdownMath: normalize } = require("../markdown-math");

test("converts mixed formulas, preserves LaTeX commands, and is idempotent", () => {
  const source = String.raw`行内 \( \frac{a}{b} + \alpha \)，行间：
\[
\begin{aligned} a &= b \\ c &= d \end{aligned}
\]
已有 $x$ 和 $$y$$。`;
  const expected = String.raw`行内 $\frac{a}{b} + \alpha$，行间：
$$
\begin{aligned} a &= b \\ c &= d \end{aligned}
$$
已有 $x$ 和 $$y$$。`;
  assert.equal(normalize(source), expected);
  assert.equal(normalize(expected), expected);
});

test("preserves code, escaped delimiters, and incomplete formulas", () => {
  const source = [
    '`\\(inline code\\)` and `` ` \\[code\\] ``',
    '```latex', '\\[fenced code\\]', '```',
    '~~~~', '\\(tilde code\\)', '~~~~',
    '    \\(indented code\\)',
    String.raw`escaped \\(x\\), unmatched \(x and \[y`,
    '```', '\\(unclosed fence\\)',
  ].join('\n');
  assert.equal(normalize(source), source);
  assert.equal(normalize('`unmatched backtick \\( x \\)'), '`unmatched backtick $x$');
});

test("does not swallow formulas following a longer inline-code marker", () => {
  assert.equal(normalize('`` ` \\(code\\) `` \\( x \\)'), '`` ` \\(code\\) `` $x$');
  assert.equal(normalize('\\[ \\] \\( \\)'), '\\[ \\] \\( \\)');
});
