/**
 * The industry a tool belongs to: the tag under a tool page's title and the
 * group it sits under on the tools index.
 *
 * The tags are the library's own industry layers, one to one, plus `core` for a
 * tool that runs on core functions alone and so suits any industry. The layer
 * ids come from `gmt-stats.json`, never a list typed here, so a tag always means
 * "this tool runs on `@northguild/gmt/<id>`". `DETAILS` below holds only what
 * the stats cannot know: the word, the one-line definition and the glyph. A
 * layer that ships with no entry here fails `tool-industries.test.ts`.
 *
 * A leaf module apart from the stats: `content.config.ts` and
 * `scripts/build-tool-index.ts` both import it, so it must not reach anything
 * generated.
 */

import { gmtStats } from "../data/gmt-stats";

export interface ToolIndustry {
  id: string;
  /** The word on the tag. Lower-cased, it is the id: the index anchors on it. */
  label: string;
  /** One line saying what the tag covers. The tag's tooltip and the index's
   *  group description. */
  definition: string;
  /** A name in `Icon.astro`'s dictionary. */
  icon: string;
  /** The guide that introduces the layer. Core has none of its own. */
  guide?: string;
}

/** The tag for a tool that runs on core functions alone. */
export const CORE_INDUSTRY = "core";

const DETAILS: Readonly<Record<string, Omit<ToolIndustry, "id">>> = {
  [CORE_INDUSTRY]: {
    label: "Core",
    definition:
      "Zones, daylight saving and intervals: the core functions every industry uses.",
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
    definition: "Container free time, demurrage and billing deadlines.",
    icon: "industry-intermodal",
    guide: "/guides/industries/intermodal-free-time-and-demurrage/",
  },
};

/** Every tag id, in display order: core first, then the layers as the stats
 *  list them. */
export const TOOL_INDUSTRY_IDS: readonly string[] = [
  CORE_INDUSTRY,
  ...gmtStats.industries,
];

export function isToolIndustryId(id: string): boolean {
  return TOOL_INDUSTRY_IDS.includes(id) && Object.hasOwn(DETAILS, id);
}

/** The tag for an id, or `undefined` for one that is not a known industry. */
export function toolIndustry(id: string): ToolIndustry | undefined {
  if (!isToolIndustryId(id)) return undefined;
  return { id, ...DETAILS[id]! };
}

/** Where a tag leads: its group on the tools index. */
export function toolIndustryHref(id: string): string {
  return `/tools/#${id}`;
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
