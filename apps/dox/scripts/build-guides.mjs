#!/usr/bin/env node
/**
 * Generate the guides-site content from canonical sources.
 *
 * Currently emits one page:
 *   - src/content/docs/guides/concepts/dst-disambiguation.md — copied from
 *     docs/dst-disambiguation.md (the single canonical source), with
 *     Starlight frontmatter prepended and the `## Further reading` link
 *     rewritten to point at the guides index.
 *
 * Run as: node apps/dox/scripts/build-guides.mjs
 *
 * Wired to the `generate` Nx target. The emitted `.md` is gitignored; the
 * canonical source stays docs/dst-disambiguation.md.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..", "..");
const dstSrc = resolve(repoRoot, "docs", "dst-disambiguation.md");
const outPath = resolve(
  appRoot,
  "src",
  "content",
  "docs",
  "guides",
  "concepts",
  "dst-disambiguation.md",
);

function shouldSkip() {
  if (!existsSync(outPath)) return false;
  if (!existsSync(dstSrc)) return false;
  return statSync(outPath).mtime > statSync(dstSrc).mtime;
}

if (shouldSkip()) {
  console.log("[guides] up-to-date, skipping");
  process.exit(0);
}

if (!existsSync(dstSrc)) {
  console.error(`ERROR: canonical source not found at ${dstSrc}`);
  process.exit(1);
}

const canonical = readFileSync(dstSrc, "utf8");

// Rewrite the `## Further reading` section's internal link from
// `context/roadmap/index.md` to the guides index, so the generated page
// doesn't leak a source-repo path into the deployed site.
const body = canonical.replace(
  /- `context\/roadmap\/index\.md` \(Story Group C\) — the internal tracking doc for rolling `disambiguation` support out across the rest of GMT's zoned-producing functions\./,
  "- [Guides](/guides/) — the rest of the guides site.",
);

const frontmatter = `---
title: DST Disambiguation
description: >
  Why the mapping between local wall-clock time and real instant breaks down
  twice a year for timezones that observe daylight saving time, and how GMT's
  disambiguation options let you control what happens.
slug: guides/concepts/dst-disambiguation
sidebar:
  order: 1
---

`;

// The canonical source opens with an H1 — drop it, the frontmatter title
// renders as the page heading.
const withoutH1 = body.replace(/^# DST Disambiguation\r?\n\r?\n?/, "");

const source = frontmatter + withoutH1;

// Idempotent write — don't bump mtime when nothing changed.
let previous = "";
try {
  previous = readFileSync(outPath, "utf8");
} catch {
  previous = "";
}

if (previous === source) {
  console.log("[guides] up to date (dst-disambiguation)");
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, source);
console.log(
  "[guides] wrote dst-disambiguation.md from docs/dst-disambiguation.md",
);
