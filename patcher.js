"use strict";

const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`;
const COPY_FUNCTION_PREFIX = String.raw`function (?<name>${IDENTIFIER})\((?<element>${IDENTIFIER}),(?<clipboard>${IDENTIFIER}),(?<selection>${IDENTIFIER})=\k<element>\.ownerDocument\.getSelection\(\)\)\{if\(\k<clipboard>==null\)return!1;let (?<result>${IDENTIFIER})=(?<extractor>${IDENTIFIER})\(\k<element>,\k<selection>\);`;
const COPY_WRITE = String.raw`\k<clipboard>\.setData\(\x60text/html\x60,\k<result>\.htmlText\),\k<clipboard>\.setData\(\x60text/plain\x60,\k<result>\.plainText\),!0`;
const COPY_FUNCTION_PATTERNS = [
  new RegExp(`${COPY_FUNCTION_PREFIX}if\\(\\k<result>==null\\)return!1;return ${COPY_WRITE}\\}`, "g"),
  new RegExp(`${COPY_FUNCTION_PREFIX}return \\k<result>==null\\?!1:\\(${COPY_WRITE}\\)\\}`, "g"),
  new RegExp(`${COPY_FUNCTION_PREFIX}return \\k<result>!=null&&\\(${COPY_WRITE}\\)\\}`, "g"),
];
const NORMALIZER_NAME = "__markdownCopyHelperNormalize";
const LEGACY_PATCH_SIGNATURE =
  't.setData("text/html",i(r.htmlText)),t.setData("text/plain",i(r.plainText))';

function normalizeMathDelimiters(value) {
  return value
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math.trim() + "$$")
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math.trim() + "$");
}

const NORMALIZER_SOURCE = `const ${NORMALIZER_NAME}=${normalizeMathDelimiters.toString()};`;

function copyFunctions(source) {
  return COPY_FUNCTION_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)]);
}

function isAlreadyPatched(source) {
  return (
    (source.includes(NORMALIZER_SOURCE) &&
      source.split(NORMALIZER_NAME).length - 1 === 3 &&
      source.includes(`text/html\`,${NORMALIZER_NAME}(`) &&
      source.includes(`text/plain\`,${NORMALIZER_NAME}(`)) ||
    (source.includes(LEGACY_PATCH_SIGNATURE) &&
      source.includes("function vZt(e,t,n=e.ownerDocument.getSelection())"))
  );
}

function supportsMarkdownCopyPatch(source) {
  const matches = copyFunctions(source);
  return (matches.length === 1 && !source.includes(NORMALIZER_NAME)) ||
    (matches.length === 0 && isAlreadyPatched(source));
}

function patchMarkdownCopy(source) {
  if (!supportsMarkdownCopyPatch(source)) {
    throw new Error(
      "The installed Codex copy implementation does not match the supported version."
    );
  }

  if (isAlreadyPatched(source)) {
    return { changed: false, source, status: "already-patched" };
  }

  const match = copyFunctions(source)[0];
  const result = match.groups.result;
  const returnIndex = match[0].lastIndexOf("return ");
  const replacement = (
    match[0].slice(0, returnIndex) + NORMALIZER_SOURCE + match[0].slice(returnIndex)
  )
    .replace(`${result}.htmlText`, `${NORMALIZER_NAME}(${result}.htmlText)`)
    .replace(`${result}.plainText`, `${NORMALIZER_NAME}(${result}.plainText)`);

  return {
    changed: true,
    source: source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length),
    status: "patched",
  };
}

module.exports = {
  NORMALIZER_NAME,
  normalizeMathDelimiters,
  patchMarkdownCopy,
  supportsMarkdownCopyPatch,
};
