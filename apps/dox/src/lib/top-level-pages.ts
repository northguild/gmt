import { INDUSTRY_LAYER_IDS } from "./industry-tags";

/**
 * The "Start here", "Migrate" and "Industries" pages both `llms.txt` and `llms-full.txt` list. The page
 * modules keep their own `import.meta.glob` (Vite resolves it per module) and
 * pass the resulting raw-source map in.
 */

/** Top-level pages that lead, in this order; any other follows alphabetically. */
const START_ORDER = [
  "index",
  "why-gmt",
  "compare",
  "upstream",
  "core-rules",
  "install",
  "bundle-size",
];

/** A glob key's path relative to `content/docs/`, without its extension. */
export function docsRelativePath(globKey: string): string {
  return globKey.replace(/^.*\/content\/docs\//, "").replace(/\.(md|mdx)$/, "");
}

const rank = (slug: string) =>
  START_ORDER.includes(slug) ? START_ORDER.indexOf(slug) : START_ORDER.length;

/** Every top-level page under content/docs/ (no directory), in sidebar order,
 * with its raw source. */
export function topLevelPages(
  raw: Record<string, string>,
): { slug: string; source: string }[] {
  return Object.entries(raw)
    .map(([key, source]) => ({ slug: docsRelativePath(key), source }))
    .filter(({ slug }) => !slug.includes("/"))
    .sort(
      (a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug),
    );
}

/**
 * The industry pages under content/docs/industries/, with their raw source: the index first, then
 * one hub per industry in declared order. A hub that is not on disk is left out, and so is a page
 * for an industry that is not declared.
 */
export function industryPages(
  raw: Record<string, string>,
): { slug: string; source: string }[] {
  const bySlug = new Map(
    Object.entries(raw).map(([key, source]) => [docsRelativePath(key), source]),
  );
  return [
    "industries/index",
    ...INDUSTRY_LAYER_IDS.map((id) => `industries/${id}`),
  ].flatMap((slug) => {
    const source = bySlug.get(slug);
    return source === undefined ? [] : [{ slug, source }];
  });
}

/** The Migrate section's pages, in reading order: the index, the five libraries, native Temporal, then the matrix. */
export const MIGRATE_ORDER = [
  "migrate/index",
  "migrate/date-fns",
  "migrate/luxon",
  "migrate/dayjs",
  "migrate/moment",
  "migrate/internationalized-date",
  "migrate/temporal",
  "compare/behaviour",
] as const;

/**
 * The Migrate pages with their raw source, in `MIGRATE_ORDER`. A page that is not on disk is left
 * out, so the lists stay valid while a page is being written.
 */
export function migratePages(
  raw: Record<string, string>,
): { slug: string; source: string }[] {
  const bySlug = new Map(
    Object.entries(raw).map(([key, source]) => [docsRelativePath(key), source]),
  );
  return MIGRATE_ORDER.flatMap((slug) => {
    const source = bySlug.get(slug);
    return source === undefined ? [] : [{ slug, source }];
  });
}
