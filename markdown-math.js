"use strict";

// Work on Markdown source, never on a rendered formula's visible glyphs.
function normalizeMarkdownMath(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    if (index === 0 || source[index - 1] === "\n") {
      const lineEnd = source.indexOf("\n", index);
      const line = source.slice(index, lineEnd < 0 ? source.length : lineEnd);
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) {
        const marker = fence[1];
        const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*\\r?$`, "gm");
        closing.lastIndex = lineEnd < 0 ? source.length : lineEnd + 1;
        const match = closing.exec(source);
        const end = match ? match.index + match[0].length : source.length;
        result += source.slice(index, end);
        index = end;
        continue;
      }
      if (/^(?: {4}|\t)/.test(line)) {
        const end = lineEnd < 0 ? source.length : lineEnd + 1;
        result += source.slice(index, end);
        index = end;
        continue;
      }
    }

    if (source[index] === "`") {
      const marker = /^`+/.exec(source.slice(index))[0];
      let end = index + marker.length;
      while ((end = source.indexOf(marker, end)) >= 0) {
        if (source[end - 1] !== "`" && source[end + marker.length] !== "`") break;
        end += marker.length;
      }
      if (end >= 0) {
        end += marker.length;
        result += source.slice(index, end);
        index = end;
        continue;
      }
      result += marker;
      index += marker.length;
      continue;
    }

    if (source[index] === "\\") {
      const next = source[index + 1];
      if (next === "(" || next === "[") {
        const closing = next === "(" ? "\\)" : "\\]";
        let end = index + 2;
        for (; end < source.length; end += 1) {
          if (source.startsWith(closing, end)) break;
          if (source[end] === "\n" &&
              (next === "(" || /^ {0,3}(`{3,}|~{3,})/.test(source.slice(end + 1)))) break;
          if (source[end] === "\\") end += 1;
        }
        if (source.startsWith(closing, end)) {
          const math = source.slice(index + 2, end).trim();
          if (math) {
            // Standalone block delimiters also work in Markdown renderers
            // that require $$ on a line of its own.
            result += next === "[" ? "$$\n" + math + "\n$$" : "$" + math + "$";
            index = end + 2;
            continue;
          }
        }
      }
      // Respect escaped backslashes and escaped backticks.
      result += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    result += source[index];
    index += 1;
  }
  return result;
}

module.exports = { normalizeMarkdownMath };
