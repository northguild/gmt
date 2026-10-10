/**
 * The industry a page belongs to: the tag under the title of a tool, a scenario
 * or a guide, and the group a tool sits under on the tools index.
 *
 * The tags are the library's own industry layers, one to one, plus `core` for a
 * page about core functions alone, which suit any industry. The layer
 * ids come from `gmt-stats.json`, never a list typed here, so a tag always means
 * "this page is about `@northguild/gmt/<id>`". `DETAILS` below holds only what
 * the stats cannot know: the word, the one-line definition and the glyph. A
 * layer that ships with no entry here fails `industry-tags.test.ts`.
 *
 * A leaf module apart from the stats: `content.config.ts` and
 * `scripts/build-tool-index.ts` both import it, so it must not reach anything
 * generated.
 */

import { gmtStats } from "../data/gmt-stats";

export interface IndustryTag {
  id: string;
  /** The word on the tag. */
  label: string;
  /** One line saying what the tag covers. The tag's tooltip and the tools
   *  index's group description. */
  definition: string;
  /** A name in `Icon.astro`'s dictionary. */
  icon: string;
  /** The guide that introduces the layer. Core has none of its own. */
  guide?: string;
}

/** The tag for a page about core functions alone. */
export const CORE_INDUSTRY = "core";

const DETAILS: Readonly<Record<string, Omit<IndustryTag, "id">>> = {
  [CORE_INDUSTRY]: {
    label: "Core",
    definition: "The core functions, which every industry uses.",
    icon: "industry-core",
  },
  transport: {
    label: "Transport",
    definition:
      "Legs, dwell, cut-offs and punctuality, shared by road, rail, sea and air.",
    icon: "industry-transport",
    guide: "/guides/industries/transport-legs-and-dwell/",
  },
  intermodal: {
    label: "Intermodal",
    definition:
      "Container free time, demurrage, billing deadlines, bill of lading dates and EDI timestamps.",
    icon: "industry-intermodal",
    guide: "/guides/industries/intermodal-free-time-and-demurrage/",
  },
};

/** Every tag id, in display order: core first, then the layers as the stats
 *  list them. */
export const INDUSTRY_TAG_IDS: readonly string[] = [
  CORE_INDUSTRY,
  ...gmtStats.industries,
];

/** The industry layers alone, without core, in the order the stats list them:
 *  the namespaces the API Reference groups under "By industry". */
export const INDUSTRY_LAYER_IDS: readonly string[] = INDUSTRY_TAG_IDS.filter(
  (id) => id !== CORE_INDUSTRY,
);

export function isIndustryTagId(id: string): boolean {
  return INDUSTRY_TAG_IDS.includes(id) && Object.hasOwn(DETAILS, id);
}

/** The tag for an id, or `undefined` for one that is not a known industry. */
export function industryTag(id: string): IndustryTag | undefined {
  if (!isIndustryTagId(id)) return undefined;
  return { id, ...DETAILS[id]! };
}

/**
 * The labels for a page's `industries` as its raw frontmatter states them
 * (`[transport]`), for the Markdown export, which reads frontmatter as text.
 * Unknown ids are dropped; a page with none gives an empty list.
 */
export function industryLabels(frontmatterValue: string | undefined): string[] {
  return (frontmatterValue ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .flatMap((id) => industryTag(id.trim())?.label ?? []);
}

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Icon inner-markup, keyed by the `icon` names above, in the transport icons'
 *  format (transport-icons.ts): a 24x24 viewBox, stroke-based, legible at 14px.
 *  A clock for core, a route between two points for transport, a container for
 *  intermodal. None reuses a transport mode's glyph, which already means that
 *  mode inside the widgets. */
export const INDUSTRY_ICON_PATHS: Readonly<Record<string, string>> = {
  "industry-core": `<g ${STROKE}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>`,
  "industry-transport": `<g ${STROKE}><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7"/></g>`,
  "industry-intermodal": `<g ${STROKE}><rect x="2" y="7" width="20" height="11" rx="1"/><path d="M6.5 10v5M10.2 10v5M13.8 10v5M17.5 10v5"/></g>`,
};

/**
 * The CSS that puts an industry's icon beside its group's label in the sidebar.
 *
 * Starlight's sidebar takes no icon for a group, so the generated sidebar marks
 * the group's Overview link with `data-gmt-industry` and this rule reaches the
 * group's `<summary>` from there with `:has()`. The glyph is the same stroke
 * path as the tag's, drawn as a mask over the label's own colour, so it has the
 * label's contrast in every theme. One rule per layer, from the same list as
 * everything else: a new layer needs no edit here.
 */
export function industrySidebarCss(): string {
  return INDUSTRY_LAYER_IDS.flatMap((id) => {
    const icon = DETAILS[id]?.icon;
    const paths = icon ? INDUSTRY_ICON_PATHS[icon] : undefined;
    if (!paths) return [];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${paths}</svg>`;
    return [
      `details:has(> ul > li > a[data-gmt-industry="${id}"]) > summary{--gmt-industry-icon:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`,
    ];
  }).join("\n");
}
