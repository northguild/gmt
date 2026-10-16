/**
 * The industry a page belongs to: the tag under the title of a tool, a scenario
 * or a guide, and the group a tool sits under on the tools index.
 *
 * Every industry is declared once, in `src/data/industries.json`: its label,
 * its one-line definition, its glyph, its guide, the namespace it owns (when it
 * has one) and the modules it draws on. The tags are those industries, in the
 * order the file lists them (an industry comes after the ones it builds on),
 * plus `core` for a page about core functions alone, which suit any industry.
 * `DETAILS` below holds only `core`, the one tag the file does not declare.
 *
 * A leaf module apart from the stats: `content.config.ts` and
 * `scripts/build-tool-index.ts` both import it, so it must not reach anything
 * generated, and it imports no `gmt-stats`.
 */

import declared from "../data/industries.json";

export interface IndustryTag {
  id: string;
  /** The word on the tag. */
  label: string;
  /** One line saying what the tag covers. The tag's tooltip and the tools
   *  index's group description. */
  definition: string;
  /** A name in `Icon.astro`'s dictionary. */
  icon: string;
  /** The guide that introduces the industry. Core has none of its own. */
  guide?: string;
}

/** One entry of `src/data/industries.json`. */
export interface IndustryDeclaration extends IndustryTag {
  guide: string;
  /** The namespace the industry owns (`@northguild/gmt/<id>`), when it has one.
   *  Equal to `id`. */
  namespace?: string;
  /** The modules it draws on: a whole namespace (`workforce`) or one
   *  sub-module (`timescale/convert`). */
  drawsOn: readonly string[];
}

/** The tag for a page about core functions alone. */
export const CORE_INDUSTRY = "core";

/** Ids no industry may take. `core` is the tag for core-only pages; `space` is
 *  taken by a planned spatial and geo expansion. */
export const RESERVED_INDUSTRY_IDS: readonly string[] = [
  CORE_INDUSTRY,
  "space",
];

/** Every declared industry, in declared order. */
export const INDUSTRIES: readonly IndustryDeclaration[] = declared;

const DETAILS: Readonly<Record<string, Omit<IndustryTag, "id">>> = {
  [CORE_INDUSTRY]: {
    label: "Core",
    definition: "The core functions, which every industry uses.",
    icon: "industry-core",
  },
  ...Object.fromEntries(
    INDUSTRIES.map(({ id, label, definition, icon, guide }) => [
      id,
      { label, definition, icon, guide },
    ]),
  ),
};

/** Every tag id, in display order: core first, then the industries as the
 *  declaration lists them. */
export const INDUSTRY_TAG_IDS: readonly string[] = [
  CORE_INDUSTRY,
  ...INDUSTRIES.map((industry) => industry.id),
];

/** The industries alone, without core, in declared order. */
export const INDUSTRY_LAYER_IDS: readonly string[] = INDUSTRY_TAG_IDS.filter(
  (id) => id !== CORE_INDUSTRY,
);

/** Every industry that owns a namespace, in declared order: the namespaces the
 *  API Reference groups under "By industry". */
export const OWN_NAMESPACES: readonly string[] = INDUSTRIES.flatMap(
  (industry) => industry.namespace ?? [],
);

/** The namespace an industry owns, or `undefined` for one that owns none. */
export function ownNamespace(id: string): string | undefined {
  return INDUSTRIES.find((industry) => industry.id === id)?.namespace;
}

/** The industry that owns a namespace, or `undefined` for a Core one. */
export function industryOwning(namespace: string): string | undefined {
  return INDUSTRIES.find((industry) => industry.namespace === namespace)?.id;
}

/** The modules an industry draws on, as declared. */
export function drawsOn(id: string): readonly string[] {
  return INDUSTRIES.find((industry) => industry.id === id)?.drawsOn ?? [];
}

/**
 * Whether a declared module (`gnss`, a whole namespace, or `timescale/convert`,
 * one sub-module) covers a module. A whole namespace covers each of its
 * modules; a sub-module covers itself alone. With no `module`, only a whole
 * namespace covers it. Every consumer matches through this, never by string
 * prefix.
 */
export function moduleCovers(
  declaredModule: string,
  namespace: string,
  module?: string,
): boolean {
  if (declaredModule === namespace) return true;
  return module !== undefined && declaredModule === `${namespace}/${module}`;
}

/**
 * Every industry whose own namespace or drawn-on modules cover a module, in
 * declared order. `declarations` is for tests that need a different set.
 */
export function industriesUsing(
  namespace: string,
  module?: string,
  declarations: readonly Pick<
    IndustryDeclaration,
    "id" | "namespace" | "drawsOn"
  >[] = INDUSTRIES,
): readonly string[] {
  return declarations
    .filter(
      (industry) =>
        industry.namespace === namespace ||
        industry.drawsOn.some((entry) =>
          moduleCovers(entry, namespace, module),
        ),
    )
    .map((industry) => industry.id);
}

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

/** Icon inner-markup, keyed by the `icon` names in `industries.json` and
 *  `DETAILS`, in the transport icons' format (transport-icons.ts): a 24x24
 *  viewBox, stroke-based, legible at 14px. A clock for core, a person beside a
 *  clock face for workforce, a route between two points for transport, a
 *  container for intermodal. None reuses a transport mode's glyph, which
 *  already means that mode inside the widgets. */
export const INDUSTRY_ICON_PATHS: Readonly<Record<string, string>> = {
  "industry-core": `<g ${STROKE}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>`,
  "industry-workforce": `<g ${STROKE}><circle cx="7" cy="7" r="3"/><path d="M2 21v-2a5 5 0 0 1 10 0v2"/><circle cx="17.5" cy="14" r="4.5"/><path d="M17.5 11.5V14l1.8 1.2"/></g>`,
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
 * label's contrast in every theme. One rule per industry that owns a namespace,
 * because only those have a reference group; a new one needs no edit here.
 */
export function industrySidebarCss(): string {
  return OWN_NAMESPACES.flatMap((namespace) => {
    const id = industryOwning(namespace)!;
    const icon = DETAILS[id]?.icon;
    const paths = icon ? INDUSTRY_ICON_PATHS[icon] : undefined;
    if (!paths) return [];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${paths}</svg>`;
    return [
      `details:has(> ul > li > a[data-gmt-industry="${id}"]) > summary{--gmt-industry-icon:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`,
    ];
  }).join("\n");
}
