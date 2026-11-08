#!/usr/bin/env node
/**
 * Generate the scenarios index page.
 *
 * Scans src/content/docs/scenarios/ for .mdx files (excluding index.mdx),
 * extracts frontmatter, and writes a generated index.mdx.
 *
 * Run as: node apps/dox/scripts/build-scenario-index.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lastUpdatedLine, newestCommit } from "./build-utils/commit-dates.mjs";
import { writeIfChanged } from "./build-utils/generated-files.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const scenariosDir = resolve(appRoot, "src", "content", "docs", "scenarios");
const indexPath = resolve(scenariosDir, "index.mdx");

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split("\n").forEach((line) => {
    const m = line.match(/^(\w+):\s*(.*)/);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      fm[m[1]] = val;
    }
  });
  return fm;
}

const files = readdirSync(scenariosDir)
  .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
  .sort();

const entries = files.map((file) => {
  const content = readFileSync(resolve(scenariosDir, file), "utf8");
  const fm = parseFrontmatter(content);
  const slug = file.replace(/\.mdx$/, "");
  return {
    slug,
    title: fm.title || slug,
    description: fm.description || "",
    path: relative(repoRoot, resolve(scenariosDir, file)).split("\\").join("/"),
  };
});

// The index is dated from the pages it lists. It is rebuilt on every run and written only when its
// text changes, so a commit that moves a page's date moves the index's.
const lastUpdated = lastUpdatedLine(newestCommit(entries.map((e) => e.path)));

const frontmatter = `---
title: Scenarios
description: Live examples showing common date/time problems and how GMT solves them.
${lastUpdated}
---

`;

const body = entries
  .map(
    (e) =>
      `## ${e.title}\n\n${e.description}\n\n- [${e.title}](/scenarios/${e.slug}/)\n`,
  )
  .join("\n\n");

const source = frontmatter + body;

if (writeIfChanged(indexPath, source)) {
  console.log(`[scenarios] wrote index.mdx with ${entries.length} entries`);
} else {
  console.log("[scenarios] up to date");
}
