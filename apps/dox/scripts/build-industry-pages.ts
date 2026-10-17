#!/usr/bin/env tsx
/**
 * Generate the industry hub pages: `/industries/` and one page per declared industry
 * (`build-utils/industry-pages.ts`), and the "Industries" group of the sidebar.
 *
 * Reads the reference corpus (`src/generated/reference/gmt-corpus.json`, the one extraction;
 * it never walks `packages/gmt/src`), the declarations in `src/data/industries.json` through
 * `src/lib/industry-tags.ts`, the overview text, and the frontmatter of every page under
 * `guides/`, `tools/`, `scenarios/` and `mistakes/`. Writes `src/content/docs/industries/`
 * and `src/generated/industries-sidebar.ts`, each file only when its content changed, and
 * deletes a hub whose industry is gone.
 *
 * Run as: tsx apps/dox/scripts/build-industry-pages.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { INDUSTRY_OVERVIEWS } from "../src/lib/industry-overview";
import { INDUSTRIES } from "../src/lib/industry-tags";
import {
  HUB_SECTIONS,
  industriesSidebarSource,
  renderIndustryHubs,
  type HubIndustry,
  type HubSectionPage,
} from "./build-utils/industry-pages";
import { syncTree, writeIfChanged } from "./build-utils/generated-files.mjs";
import type { IndexedPage } from "./build-utils/index-pages";
import { readSectionPage } from "./build-utils/industry-sidebar";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(appRoot, "src", "content", "docs");
const corpusFile = resolve(
  appRoot,
  "src",
  "generated",
  "reference",
  "gmt-corpus.json",
);

interface CorpusFunction extends IndexedPage {
  kind: string;
}

const pages: IndexedPage[] = (
  JSON.parse(readFileSync(corpusFile, "utf8")) as CorpusFunction[]
)
  .filter((entry) => entry.kind === "function")
  .map(({ namespace, module, name, url, description }) => ({
    namespace,
    module,
    name,
    url,
    description,
  }));

const industries: HubIndustry[] = INDUSTRIES.map((industry) => {
  const overview = INDUSTRY_OVERVIEWS[industry.id];
  if (!overview) {
    throw new Error(
      `[industries] the industry ${industry.id} has no overview text. Add it to src/lib/industry-overview.ts.`,
    );
  }
  return {
    id: industry.id,
    label: industry.label,
    definition: industry.definition,
    guide: industry.guide,
    guideTitle: overview.guideTitle,
    about: overview.about,
    solves: overview.solves,
    namespace: industry.namespace,
    drawsOn: industry.drawsOn,
  };
});

/** Every page of a section, an index page excepted: it carries no tag. */
function sectionPages(section: string): HubSectionPage[] {
  const dir = resolve(docsDir, section);
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => /\.mdx?$/.test(file) && !/(^|\/)index\.mdx?$/.test(file))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.mdx?$/, "");
      const page = readSectionPage(
        `${section}/${slug}`,
        readFileSync(resolve(dir, file), "utf8"),
      );
      return {
        section: section as HubSectionPage["section"],
        slug,
        title: page.title,
        description: page.description,
        industries: page.industries,
      };
    });
}

const hubs = renderIndustryHubs({
  industries,
  pages,
  sectionPages: HUB_SECTIONS.flatMap(({ section }) => sectionPages(section)),
});

const changes = syncTree(
  resolve(docsDir, "industries"),
  new Map(hubs.map((hub) => [hub.file, hub.mdx])),
);
const sidebarWritten = writeIfChanged(
  resolve(appRoot, "src", "generated", "industries-sidebar.ts"),
  industriesSidebarSource(industries),
);
console.log(
  `[industries] ${hubs.length} pages (${changes.written} written, ${changes.removed} removed); sidebar ${sidebarWritten ? "written" : "up to date"}`,
);
