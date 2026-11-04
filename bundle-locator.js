"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { supportsMarkdownCopyPatch } = require("./patcher");

function selectPatchableMarkdownBundle(candidates) {
  const matches = candidates.filter((candidate) =>
    supportsMarkdownCopyPatch(candidate.source)
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one patchable Codex Markdown bundle, found ${matches.length} among ${candidates.length} JavaScript bundles.`
    );
  }

  return matches[0].name;
}

async function findMarkdownBundle(assetDirectory) {
  const entries = await fs.readdir(assetDirectory, { withFileTypes: true });
  const matches = [];
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    count += 1;
    const source = await fs.readFile(path.join(assetDirectory, entry.name), "utf8");
    // Skip unrelated chunks before running the minified-function patterns.
    if (!source.includes("setData(") || !source.includes("htmlText")) continue;
    if (supportsMarkdownCopyPatch(source)) matches.push({ name: entry.name, source });
  }
  if (matches.length !== 1) {
    throw new Error(
      `Expected one patchable Codex Markdown bundle, found ${matches.length} among ${count} JavaScript bundles.`
    );
  }
  return path.join(assetDirectory, matches[0].name);
}

module.exports = {
  findMarkdownBundle,
  selectPatchableMarkdownBundle,
};
