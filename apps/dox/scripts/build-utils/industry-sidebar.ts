/**
 * A sidebar section grouped by industry: Tools, Scenarios and Mistakes.
 *
 * The section's index page comes first. Then each industry with at least one page gets a
 * divider and its pages, in the tag order (`INDUSTRY_TAG_IDS`: core, then the layers as the
 * stats list them) and, inside an industry, by title. The tools index groups the same way,
 * from the same frontmatter, so the menu and the index never disagree.
 *
 * A divider is a link entry marked `data-gmt-divider`, the API Reference's "By industry"
 * mechanism: `SidebarSublist.astro` draws it as a label, not a link, and `Sidebar.astro`
 * keeps it out of the previous and next links. It also carries `data-gmt-industry`, so the
 * label shows the industry's tag icon. Its link, `#<section>-<industry>`, is never followed;
 * it only gives the label a page-unique id.
 */

import { INDUSTRY_TAG_IDS, industryTag } from "../../src/lib/industry-tags";

/** A page in a section, as its frontmatter states it. */
export interface SectionPage {
  /** The file name without `.mdx`. */
  slug: string;
  title: string;
  industries: readonly string[];
}

/** One sidebar entry, in Starlight's user config shape. */
export type IndustrySidebarEntry =
  | { slug: string }
  | {
      label: string;
      link: string;
      attrs: { "data-gmt-divider": "true"; "data-gmt-industry": string };
    };

/** The entries for `section` (a docs directory such as `tools`), in display order. */
export function industrySidebarEntries(
  section: string,
  pages: readonly SectionPage[],
): IndustrySidebarEntry[] {
  const byTitle = [...pages].sort((a, b) => a.title.localeCompare(b.title, "en"));
  return [
    { slug: section },
    ...INDUSTRY_TAG_IDS.flatMap((id): IndustrySidebarEntry[] => {
      const tag = industryTag(id);
      const members = byTitle.filter((page) => page.industries.includes(id));
      if (!tag || members.length === 0) return [];
      return [
        {
          label: tag.label,
          link: `#${section}-${id}`,
          attrs: { "data-gmt-divider": "true", "data-gmt-industry": id },
        },
        ...members.map((page) => ({ slug: `${section}/${page.slug}` })),
      ];
    }),
  ];
}

/** The generated module `astro.config.mjs` imports for `section`, exporting `name`. */
export function industrySidebarSource(
  name: string,
  section: string,
  pages: readonly SectionPage[],
): string {
  const lines = industrySidebarEntries(section, pages).map(
    (entry) => `  ${JSON.stringify(entry)},`,
  );
  return [
    "// GENERATED FILE — do not edit by hand.",
    "// Produced by apps/dox/scripts/build-industry-sidebars.ts.",
    'import type { StarlightUserConfig } from "@astrojs/starlight/types";',
    "",
    'type SidebarItem = NonNullable<StarlightUserConfig["sidebar"]>[number];',
    "",
    `export const ${name}: SidebarItem[] = [`,
    ...lines,
    "];",
    "",
  ].join("\n");
}

/**
 * A page's title and industries from its raw frontmatter, or an error naming the file when
 * it states no industry. Quoted values lose their quotes.
 */
export function readSectionPage(slug: string, source: string): SectionPage {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (name: string): string =>
    frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
  const unquote = (value: string): string =>
    /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
  const industries = field("industries")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (industries.length === 0) {
    throw new Error(`[sidebar] ${slug}.mdx has no \`industries\` in its frontmatter`);
  }
  return { slug, title: unquote(field("title")) || slug, industries };
}
