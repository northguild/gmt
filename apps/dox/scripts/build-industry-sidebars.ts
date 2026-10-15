#!/usr/bin/env tsx
/**
 * Generate the Tools, Scenarios and Mistakes sections of the sidebar, each grouped by
 * industry under a divider (`build-utils/industry-sidebar.ts`).
 *
 * Reads every page's title and `industries` from its frontmatter and writes
 * src/generated/<section>-sidebar.ts, which `astro.config.mjs` imports. A file is written
 * only when its content changed, so an unchanged run touches nothing. A page with no
 * `industries` stops the run, as it stops the tools index.
 *
 * Run as: tsx apps/dox/scripts/build-industry-sidebars.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeIfChanged } from "./build-utils/generated-files.mjs";
import {
  industrySidebarSource,
  readSectionPage,
} from "./build-utils/industry-sidebar";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(appRoot, "src", "content", "docs");

/** Each section's directory and the name its generated module exports. */
const SECTIONS = [
  { section: "tools", name: "toolsSidebar" },
  { section: "scenarios", name: "scenariosSidebar" },
  { section: "mistakes", name: "mistakesSidebar" },
] as const;

for (const { section, name } of SECTIONS) {
  const dir = resolve(docsDir, section);
  const pages = readdirSync(dir)
    .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
    .map((file) =>
      readSectionPage(file.replace(/\.mdx$/, ""), readFileSync(resolve(dir, file), "utf8")),
    );
  const out = resolve(appRoot, "src", "generated", `${section}-sidebar.ts`);
  const written = writeIfChanged(out, industrySidebarSource(name, section, pages));
  console.log(
    written
      ? `[sidebar] wrote ${section}-sidebar.ts with ${pages.length} pages`
      : `[sidebar] ${section} up to date`,
  );
}
