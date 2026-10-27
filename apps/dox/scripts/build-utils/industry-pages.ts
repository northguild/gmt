/**
 * The industry hub pages: `/industries/` and one page per declared industry.
 *
 * A hub says what the industry is, what its functions solve, the guide to start with, the
 * functions it owns and the ones it draws on, then every guide, tool, scenario and mistakes
 * page that carries its tag. The text comes from `src/lib/industry-overview.ts`, the lists
 * from the corpus and from the pages' frontmatter.
 *
 * Pure: the declarations, the corpus's functions and the pages' frontmatter in, the files'
 * text out. `scripts/build-industry-pages.ts` reads and writes. The hubs are plain Markdown
 * and import no component, so `stripMdx` and the `.md` twin need nothing new.
 */

import type { PainPoint } from "../../src/lib/industry-overview";
import { moduleCovers } from "../../src/lib/industry-tags";
import { listItem, type IndexedPage } from "./index-pages";
import { mdCodeSpan, mdText } from "./render-table";

/** An industry as the hubs need it: its declaration and its overview text. */
export interface HubIndustry {
  id: string;
  label: string;
  definition: string;
  /** The guide that introduces it, as a site path. */
  guide: string;
  /** The guide's own title. */
  guideTitle: string;
  /** What the industry is, in plain words. */
  about: string;
  solves: readonly PainPoint[];
  /** The namespace it owns (equal to `id`), when it owns one. */
  namespace?: string;
  /** The modules it draws on, in declared order. */
  drawsOn: readonly string[];
}

/** The four sections whose pages carry an industry tag, in the order a hub lists them. */
export const HUB_SECTIONS = [
  { section: "guides", heading: "Guides" },
  { section: "tools", heading: "Tools" },
  { section: "scenarios", heading: "Scenarios" },
  { section: "mistakes", heading: "Mistakes" },
] as const;

export type HubSection = (typeof HUB_SECTIONS)[number]["section"];

/** A guide, tool, scenario or mistakes page, as its frontmatter states it. */
export interface HubSectionPage {
  section: HubSection;
  /** The path under the section, without `.mdx`: `industries/transport-legs-and-dwell`. */
  slug: string;
  title: string;
  description: string;
  industries: readonly string[];
}

/** One generated file under `src/content/docs/industries/`. */
export interface HubFile {
  /** `index.mdx` or `<id>.mdx`. */
  file: string;
  mdx: string;
}

export interface HubInput {
  industries: readonly HubIndustry[];
  /** Every public function the corpus holds. */
  pages: readonly IndexedPage[];
  /** Every page of the four sections. */
  sectionPages: readonly HubSectionPage[];
}

const conjunction = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

/** The link to a module's index page: a namespace (`gnss`) or a sub-module (`timescale/convert`). */
function moduleLink(module: string): string {
  return `[${mdCodeSpan(module)}](/reference/${module})`;
}

const byName = <T extends { name: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

/** The functions a declared module covers: a whole namespace, or one sub-module. */
function functionsOf(
  pages: readonly IndexedPage[],
  module: string,
): IndexedPage[] {
  return pages.filter((p) => moduleCovers(module, p.namespace, p.module));
}

/** Every function the industry owns or draws on. */
function reachableFunctions(
  industry: HubIndustry,
  pages: readonly IndexedPage[],
): IndexedPage[] {
  const modules = [
    ...(industry.namespace ? [industry.namespace] : []),
    ...industry.drawsOn,
  ];
  return pages.filter((p) =>
    modules.some((module) => moduleCovers(module, p.namespace, p.module)),
  );
}

/**
 * One "What these functions solve" item: the problem sentence with each `{{name}}` turned
 * into a link to that function's page, then the pages that show it. The text ends its own
 * sentence. A name outside the industry's own namespace and the modules it draws on stops the
 * generator, so a renamed function cannot leave a dead link.
 */
export function painPointItem(
  industry: Pick<HubIndustry, "id">,
  point: PainPoint,
  reachable: readonly IndexedPage[],
): string {
  const pieces = point.answer.split(/\{\{(\w+)\}\}/);
  const answer = pieces
    .map((piece, i) => {
      if (i % 2 === 0) return mdText(piece);
      const target = reachable.find((p) => p.name === piece);
      if (!target) {
        throw new Error(
          `[industries] the ${industry.id} overview names ${piece}, which is neither in ${industry.id}'s own namespace nor in a module it draws on. Fix src/lib/industry-overview.ts.`,
        );
      }
      return `[${mdCodeSpan(piece)}](${target.url})`;
    })
    .join("");
  const see = point.see.map((l) => `[${mdText(l.label)}](${l.href})`);
  return `- **${mdText(point.problem)}** ${answer}${see.length ? ` See ${see.join(", ")}.` : ""}`;
}

/** A module's functions grouped by module, each module a bold link to its index page. */
function moduleLists(
  namespace: string,
  functions: readonly IndexedPage[],
): string[] {
  const modules = [...new Set(functions.map((p) => p.module))].sort();
  return modules.flatMap((module) => [
    `**[${mdText(module)}](/reference/${namespace}/${module})**`,
    "",
    ...byName(functions.filter((p) => p.module === module)).map(listItem),
    "",
  ]);
}

/**
 * The lists of functions under one declared module: a whole namespace, headed by its own link
 * with each of its modules below; a sub-module, headed by `namespace/module` with only its
 * own functions below.
 */
function moduleSection(
  module: string,
  pages: readonly IndexedPage[],
): string[] {
  const functions = functionsOf(pages, module);
  const [namespace] = module.split("/") as [string];
  return [
    `### ${moduleLink(module)}`,
    "",
    ...moduleLists(namespace, functions),
  ];
}

const frontmatter = (title: string, description: string, tag?: string) => [
  `---`,
  `title: ${JSON.stringify(title)}`,
  `description: ${JSON.stringify(description)}`,
  ...(tag ? [`industries: [${tag}]`] : []),
  // The block form, the only one `ensure-sidebar-order.mjs` leaves alone.
  `sidebar:`,
  `  order: 0`,
  `---`,
  "",
];

/** The page of one industry. */
function renderHub(
  industry: HubIndustry,
  input: HubInput,
  ownerOf: ReadonlyMap<string, HubIndustry>,
): HubFile {
  const lines = frontmatter(industry.label, industry.definition, industry.id);
  lines.push(mdText(industry.about), "");

  const reachable = reachableFunctions(industry, input.pages);
  lines.push(`## What these functions solve`, "");
  for (const point of industry.solves) {
    lines.push(painPointItem(industry, point, reachable));
  }
  lines.push("");
  lines.push(
    `Start with the guide: [${mdText(industry.guideTitle)}](${industry.guide}).`,
    "",
  );

  if (industry.namespace) {
    lines.push(`## Its own functions`, "");
    lines.push(...moduleSection(industry.namespace, input.pages));
  }

  if (industry.drawsOn.length > 0) {
    lines.push(`## Functions it draws on`, "");
    for (const module of industry.drawsOn) {
      lines.push(`### ${moduleLink(module)}`, "");
      // Another industry's own namespace is a shared industry layer, and has a hub.
      const owner = ownerOf.get(module.split("/")[0]!);
      if (owner) {
        lines.push(
          `Part of the [${mdText(owner.label)}](/industries/${owner.id}/) industry layer.`,
          "",
        );
      }
      const [namespace] = module.split("/") as [string];
      lines.push(...moduleLists(namespace, functionsOf(input.pages, module)));
    }
  }

  for (const { section, heading } of HUB_SECTIONS) {
    const members = input.sectionPages
      .filter(
        (p) => p.section === section && p.industries.includes(industry.id),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "en"));
    if (members.length === 0) continue;
    lines.push(`## ${heading}`, "");
    for (const p of members) {
      const link = `[${mdText(p.title)}](/${section}/${p.slug}/)`;
      lines.push(
        p.description ? `- ${link}: ${mdText(p.description)}` : `- ${link}`,
      );
    }
    lines.push("");
  }
  return { file: `${industry.id}.mdx`, mdx: lines.join("\n") };
}

/** `/industries/`: every industry, with the namespace it owns and the modules it draws on. */
function renderIndex(industries: readonly HubIndustry[]): HubFile {
  const lines = frontmatter(
    "By industry",
    "Every industry the library has a layer for: what it solves, the namespace it owns and the modules it draws on.",
  );
  lines.push(
    "Each industry has a page of its own. An industry may own a namespace, draw on another industry's layer or on core modules, or both.",
    "",
  );
  for (const industry of industries) {
    const parts = [
      `- [${mdText(industry.label)}](/industries/${industry.id}/): ${mdText(industry.definition)}`,
    ];
    if (industry.namespace) {
      parts.push(`Its namespace is ${moduleLink(industry.namespace)}.`);
    }
    if (industry.drawsOn.length > 0) {
      parts.push(
        `Draws on ${conjunction.format(industry.drawsOn.map(moduleLink))}.`,
      );
    }
    lines.push(parts.join(" "));
  }
  lines.push("");
  return { file: "index.mdx", mdx: lines.join("\n") };
}

/** The index and one page per industry, in declared order. */
export function renderIndustryHubs(input: HubInput): HubFile[] {
  const ownerOf = new Map(
    input.industries.flatMap((i) =>
      i.namespace ? [[i.namespace, i] as const] : [],
    ),
  );
  return [
    renderIndex(input.industries),
    ...input.industries.map((industry) => renderHub(industry, input, ownerOf)),
  ];
}

/**
 * The generated module `astro.config.mjs` imports for the "Industries" group: the overview,
 * then one link per industry. Each link carries `data-gmt-industry-link`, which
 * `SidebarSublist.astro` reads to draw the industry's glyph. The attribute is not
 * `data-gmt-industry`: the group-icon rule reads that one off a group's `Overview` link and
 * would paint the "Industries" group's own summary.
 */
export function industriesSidebarSource(
  industries: readonly Pick<HubIndustry, "id" | "label">[],
): string {
  const entries = [
    { label: "Overview", slug: "industries" },
    ...industries.map(({ id, label }) => ({
      label,
      slug: `industries/${id}`,
      attrs: { "data-gmt-industry-link": id },
    })),
  ];
  return [
    "// GENERATED FILE — do not edit by hand.",
    "// Produced by apps/dox/scripts/build-industry-pages.ts.",
    'import type { StarlightUserConfig } from "@astrojs/starlight/types";',
    "",
    'type SidebarItem = NonNullable<StarlightUserConfig["sidebar"]>[number];',
    "",
    "export const industriesSidebar: SidebarItem[] = [",
    ...entries.map((entry) => `  ${JSON.stringify(entry)},`),
    "];",
    "",
  ].join("\n");
}
