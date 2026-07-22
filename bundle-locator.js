"use strict";

const { supportsMarkdownCopyPatch } = require("./patcher");

function selectPatchableMarkdownBundle(candidates) {
  const matches = candidates.filter((candidate) =>
    supportsMarkdownCopyPatch(candidate.source)
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one patchable Codex Markdown bundle, found ${matches.length} among ${candidates.length} markdown bundles.`
    );
  }

  return matches[0].name;
}

module.exports = {
  selectPatchableMarkdownBundle,
};
