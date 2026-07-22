"use strict";

const INLINE_SOURCE = "e.textContent=`${pr[0]}${e.textContent??``}${pr[1]}`";
const DISPLAY_SOURCE = "t.textContent=`${mr[0]}${Gr(e)}${mr[1]}`";
const INLINE_REPLACEMENT = "e.textContent=`$${e.textContent??``}$`";
const DISPLAY_REPLACEMENT = "t.textContent=`$$${Gr(e)}$$`";
const HTML_CLIPBOARD_SOURCE = "t.setData(`text/html`,r.htmlText)";
const PLAIN_TEXT_CLIPBOARD_SOURCE = "t.setData(`text/plain`,r.plainText)";
const CLIPBOARD_SOURCE = `${HTML_CLIPBOARD_SOURCE},${PLAIN_TEXT_CLIPBOARD_SOURCE}`;
const LEGACY_PLAIN_TEXT_REPLACEMENT = String.raw`t.setData("text/plain",r.plainText.replace(/\\\[([\s\S]*?)\\\]/g,(e,t)=>"$$"+t+"$$").replace(/\\\(([\s\S]*?)\\\)/g,(e,t)=>"$"+t+"$"))`;
const LEGACY_CLIPBOARD_REPLACEMENT = `${HTML_CLIPBOARD_SOURCE},${LEGACY_PLAIN_TEXT_REPLACEMENT}`;
const PREVIOUS_PLAIN_TEXT_REPLACEMENT = String.raw`t.setData("text/plain",(()=>{let e=t=>{t=t.trim();return t.length>=4&&t.startsWith("$$")&&t.endsWith("$$")?t.slice(2,-2).trim():t.length>=4&&t.startsWith("\\[")&&t.endsWith("\\]")?t.slice(2,-2).trim():t.length>=4&&t.startsWith("\\(")&&t.endsWith("\\)")?t.slice(2,-2).trim():t.length>=2&&t.startsWith("$")&&t.endsWith("$")?t.slice(1,-1).trim():t};return r.plainText.replace(/\\\[([\s\S]*?)\\\]/g,(t,r)=>"$$"+e(r)+"$$").replace(/\\\(([\s\S]*?)\\\)/g,(t,r)=>"$"+e(r)+"$")})())`;
const PREVIOUS_CLIPBOARD_REPLACEMENT = `${HTML_CLIPBOARD_SOURCE},${PREVIOUS_PLAIN_TEXT_REPLACEMENT}`;
const CLIPBOARD_REPLACEMENT = String.raw`(()=>{let e=t=>{t=t.trim();return t.length>=4&&t.startsWith("$$")&&t.endsWith("$$")?t.slice(2,-2).trim():t.length>=4&&t.startsWith("\\[")&&t.endsWith("\\]")?t.slice(2,-2).trim():t.length>=4&&t.startsWith("\\(")&&t.endsWith("\\)")?t.slice(2,-2).trim():t.length>=2&&t.startsWith("$")&&t.endsWith("$")?t.slice(1,-1).trim():t},n=t=>t.replace(/\\\[([\s\S]*?)\\\]/g,(t,r)=>"$$"+e(r)+"$$").replace(/\\\(([\s\S]*?)\\\)/g,(t,r)=>"$"+e(r)+"$");t.setData("text/html",n(r.htmlText)),t.setData("text/plain",n(r.plainText))})()`;

function unwrapMathDelimiters(value) {
  const math = value.trim();

  if (
    (math.startsWith("$$") && math.endsWith("$$")) ||
    (math.startsWith("\\[") && math.endsWith("\\]")) ||
    (math.startsWith("\\(") && math.endsWith("\\)"))
  ) {
    return math.slice(2, -2).trim();
  }
  if (math.startsWith("$") && math.endsWith("$")) {
    return math.slice(1, -1).trim();
  }
  return math;
}

function normalizeMathDelimiters(text) {
  return text
    .replace(
      /\\\[([\s\S]*?)\\\]/g,
      (_, math) => "$$" + unwrapMathDelimiters(math) + "$$"
    )
    .replace(
      /\\\(([\s\S]*?)\\\)/g,
      (_, math) => "$" + unwrapMathDelimiters(math) + "$"
    );
}

function supportsMarkdownCopyPatch(source) {
  const hasOriginalMathNodeSource =
    source.includes(INLINE_SOURCE) && source.includes(DISPLAY_SOURCE);
  const hasLegacyMathNodePatch =
    source.includes(INLINE_REPLACEMENT) &&
    source.includes(DISPLAY_REPLACEMENT);
  const hasCurrentClipboardPatch = source.includes(CLIPBOARD_REPLACEMENT);
  const hasLegacyClipboardPatch = source.includes(
    LEGACY_CLIPBOARD_REPLACEMENT
  );
  const hasPreviousClipboardPatch = source.includes(
    PREVIOUS_CLIPBOARD_REPLACEMENT
  );
  const hasOriginalClipboardSource = source.includes(CLIPBOARD_SOURCE);

  return (
    (hasOriginalMathNodeSource || hasLegacyMathNodePatch) &&
    (hasCurrentClipboardPatch ||
      hasLegacyClipboardPatch ||
      hasPreviousClipboardPatch ||
      hasOriginalClipboardSource)
  );
}

function patchMarkdownCopy(source) {
  if (!supportsMarkdownCopyPatch(source)) {
    throw new Error(
      "The installed Codex Markdown bundle does not match the supported copy implementation."
    );
  }

  const hasOriginalMathNodeSource =
    source.includes(INLINE_SOURCE) && source.includes(DISPLAY_SOURCE);
  const hasLegacyMathNodePatch =
    source.includes(INLINE_REPLACEMENT) &&
    source.includes(DISPLAY_REPLACEMENT);
  const hasCurrentClipboardPatch = source.includes(CLIPBOARD_REPLACEMENT);
  const hasLegacyClipboardPatch = source.includes(
    LEGACY_CLIPBOARD_REPLACEMENT
  );
  const hasPreviousClipboardPatch = source.includes(
    PREVIOUS_CLIPBOARD_REPLACEMENT
  );
  const hasOriginalClipboardSource = source.includes(CLIPBOARD_SOURCE);

  if (hasOriginalMathNodeSource && hasCurrentClipboardPatch) {
    return { changed: false, source, status: "already-patched" };
  }

  let patchedSource = source;
  if (hasLegacyMathNodePatch) {
    patchedSource = patchedSource
      .replace(INLINE_REPLACEMENT, () => INLINE_SOURCE)
      .replace(DISPLAY_REPLACEMENT, () => DISPLAY_SOURCE);
  }
  if (hasLegacyClipboardPatch) {
    patchedSource = patchedSource.replace(
      LEGACY_CLIPBOARD_REPLACEMENT,
      () => CLIPBOARD_REPLACEMENT
    );
  } else if (hasPreviousClipboardPatch) {
    patchedSource = patchedSource.replace(
      PREVIOUS_CLIPBOARD_REPLACEMENT,
      () => CLIPBOARD_REPLACEMENT
    );
  } else if (hasOriginalClipboardSource) {
    patchedSource = patchedSource.replace(
      CLIPBOARD_SOURCE,
      () => CLIPBOARD_REPLACEMENT
    );
  }

  return {
    changed: true,
    source: patchedSource,
    status: "patched",
  };
}

module.exports = {
  CLIPBOARD_REPLACEMENT,
  CLIPBOARD_SOURCE,
  DISPLAY_REPLACEMENT,
  DISPLAY_SOURCE,
  HTML_CLIPBOARD_SOURCE,
  INLINE_REPLACEMENT,
  INLINE_SOURCE,
  LEGACY_CLIPBOARD_REPLACEMENT,
  normalizeMathDelimiters,
  patchMarkdownCopy,
  PREVIOUS_CLIPBOARD_REPLACEMENT,
  supportsMarkdownCopyPatch,
  unwrapMathDelimiters,
};
