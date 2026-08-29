#!/usr/bin/env node
/**
 * Generate the scenarios index page.
 *
 * Scans src/content/docs/scenarios/ for .mdx files (excluding index.mdx),
 * extracts frontmatter, and writes a generated index.mdx.
 *
 * Run as: node apps/dox/scripts/build-scenario-index.mjs
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
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

function getMtime(path) {
  try {
    return statSync(path).mtime;
  } catch {
    return 0;
  }
}

function shouldSkip() {
  if (!existsSync(indexPath)) return false;
  const entries = readdirSync(scenariosDir);
  const latest = entries
    .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
    .map((f) => getMtime(resolve(scenariosDir, f)))
    .concat(getMtime(indexPath))
    .sort((a, b) => b - a)[0];
  return getMtime(indexPath) >= latest;
}

if (shouldSkip()) {
  console.log("[scenarios] up-to-date, skipping");
  process.exit(0);
}

const files = readdirSync(scenariosDir)
  .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
  .sort();

const entries = files.map((file) => {
  const content = readFileSync(resolve(scenariosDir, file), "utf8");
  const fm = parseFrontmatter(content);
  const slug = file.replace(/\.mdx$/, "");
  return { slug, title: fm.title || slug, description: fm.description || "" };
});

const frontmatter = `---
title: Scenarios
description: Live examples showing common date/time problems and how GMT solves them.
---

`;

const body = entries
  .map(
    (e) =>
      `## ${e.title}\n\n${e.description}\n\n- [${e.title}](/scenarios/${e.slug}/)\n`,
  )
  .join("\n\n");

const source = frontmatter + body;

let previous = "";
try {
  previous = readFileSync(indexPath, "utf8");
} catch {
  previous = "";
}

if (previous === source) {
  console.log("[scenarios] up to date");
  process.exit(0);
}

writeFileSync(indexPath, source);
console.log(`[scenarios] wrote index.mdx with ${entries.length} entries`);
