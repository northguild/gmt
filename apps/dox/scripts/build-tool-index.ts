#!/usr/bin/env tsx
/**
 * Generate the tools index page.
 *
 * Scans src/content/docs/tools/ for .mdx files (excluding index.mdx), reads
 * each page's title, description and industries from its frontmatter, and
 * writes a generated index.mdx that lists every tool under its industry.
 *
 * The page is plain Markdown on purpose: headings, a line of text and a list of
 * links. That gives each industry a heading the tags on a tool page can link
 * to (`/tools/#transport`), puts the groups in the table of contents, and
 * exports to the `.md` routes as it stands, with no component for the Markdown
 * exporter to learn.
 *
 * Run as: tsx apps/dox/scripts/build-tool-index.ts
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TOOL_INDUSTRY_IDS,
  toolIndustry,
} from "../src/lib/tool-industries";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = resolve(appRoot, "src", "content", "docs", "tools");
const indexPath = resolve(toolsDir, "index.mdx");

interface Tool {
  slug: string;
  title: string;
  description: string;
  industries: string[];
}

const unquote = (value: string): string =>
  value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

function readTool(file: string): Tool {
  const source = readFileSync(resolve(toolsDir, file), "utf8");
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (name: string): string =>
    frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
  const slug = file.replace(/\.mdx$/, "");
  const industries = field("industries")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (industries.length === 0) {
    throw new Error(`[tools] ${file} has no \`industries\` in its frontmatter`);
  }
  return {
    slug,
    title: unquote(field("title")) || slug,
    description: unquote(field("description")),
    industries,
  };
}

const tools = readdirSync(toolsDir)
  .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
  .map(readTool)
  .sort((a, b) => a.title.localeCompare(b.title, "en"));

const sections = TOOL_INDUSTRY_IDS.flatMap((id) => {
  const industry = toolIndustry(id);
  const members = tools.filter((tool) => tool.industries.includes(id));
  if (!industry || members.length === 0) return [];
  const guide = industry.guide ? ` [Read the guide](${industry.guide}).` : "";
  const list = members
    .map((tool) => `- [${tool.title}](/tools/${tool.slug}/): ${tool.description}`)
    .join("\n");
  return [`## ${industry.label}\n\n${industry.definition}${guide}\n\n${list}\n`];
});

const source = `---
title: Tools
description: Every interactive tool on the site, grouped by the industry it belongs to.
sidebar:
  order: 0
  label: All tools
---

Each tool runs the real library on values you set. A tool is listed under the industry layer
its functions come from; a tool under Core uses core functions only, so it suits any industry.

${sections.join("\n")}`;

let previous = "";
try {
  previous = readFileSync(indexPath, "utf8");
} catch {
  previous = "";
}

if (previous === source) {
  console.log("[tools] up to date");
} else {
  writeFileSync(indexPath, source);
  console.log(`[tools] wrote index.mdx with ${tools.length} tools`);
}
