"use strict";

// Codex 26.5908.31748 copies a selection through vZt, immediately before it
// writes both rich HTML and plain text to the clipboard.
const COPY_HANDLER_ANCHOR =
  "function yZt(e,t){let n=t.cloneRange();if(!kZt(n,e))return null;";
const COPY_FUNCTION_SOURCE =
  "function vZt(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=gZt(e,n);return r==null?!1:(t.setData(`text/html`,r.htmlText),t.setData(`text/plain`,r.plainText),!0)}";
const COPY_FUNCTION_REPLACEMENT = String.raw`function vZt(e,t,n=e.ownerDocument.getSelection()){if(t==null)return!1;let r=gZt(e,n);if(r==null)return!1;let i=e=>e.replace(/\\\[([\s\S]*?)\\\]/g,(e,t)=>"$$"+t.trim()+"$$").replace(/\\\(([\s\S]*?)\\\)/g,(e,t)=>"$"+t.trim()+"$");return t.setData("text/html",i(r.htmlText)),t.setData("text/plain",i(r.plainText)),!0}`;

function normalizeMathDelimiters(value) {
  return value
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math.trim() + "$$")
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math.trim() + "$");
}

function supportsMarkdownCopyPatch(source) {
  return (
    source.includes(COPY_HANDLER_ANCHOR) &&
    (source.includes(COPY_FUNCTION_SOURCE) ||
      source.includes(COPY_FUNCTION_REPLACEMENT))
  );
}

function patchMarkdownCopy(source) {
  if (!supportsMarkdownCopyPatch(source)) {
    throw new Error(
      "The installed Codex copy implementation does not match the supported version."
    );
  }

  if (source.includes(COPY_FUNCTION_REPLACEMENT)) {
    return { changed: false, source, status: "already-patched" };
  }

  return {
    changed: true,
    source: source.replace(COPY_FUNCTION_SOURCE, () => COPY_FUNCTION_REPLACEMENT),
    status: "patched",
  };
}

module.exports = {
  COPY_FUNCTION_REPLACEMENT,
  COPY_FUNCTION_SOURCE,
  COPY_HANDLER_ANCHOR,
  normalizeMathDelimiters,
  patchMarkdownCopy,
  supportsMarkdownCopyPatch,
};
