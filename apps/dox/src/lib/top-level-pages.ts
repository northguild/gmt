import { INDUSTRY_LAYER_IDS } from "./industry-tags";
import { MIGRATE, START_HERE } from "./section-order";

/**
 * The "Start here", "Migrate" and "Industries" pages both `llms.txt` and `llms-full.txt` list. Their
 * order is set in `section-order.ts`. The page modules keep their own `import.meta.glob` (Vite resolves it per module) and
 * pass the resulting raw-source map in.
 */

/** A sidebar slug as the raw page glob keys it: the Migrate overview is a folder index. */
const pageKey = (slug: string) => (slug === "migrate" ? "migrate/index" : slug);

/** Top-level pages that lead, in this order; any other follows alphabetically. */
const LEADING = ["index", ...START_HERE.map((entry) => entry.slug)];

/** Top-level pages the Migrate group lists, so Start here does not. */
const MIGRATE_SLUGS: ReadonlySet<string> = new Set(
  MIGRATE.map((entry) => entry.slug),
);

/** A glob key's path relative to `content/docs/`, without its extension. */
export function docsRelativePath(globKey: string): string {
  return globKey.replace(/^.*\/content\/docs\//, "").replace(/\.(md|mdx)$/, "");
}

const rank = (slug: string) =>
  LEADING.includes(slug) ? LEADING.indexOf(slug) : LEADING.length;

/** Every top-level page under content/docs/ (no directory) that Start here shows, in sidebar order,
 * with its raw source. The pages the Migrate group lists are left out. */
export function topLevelPages(
  raw: Record<string, string>,
): { slug: string; source: string }[] {
  return Object.entries(raw)
    .map(([key, source]) => ({ slug: docsRelativePath(key), source }))
    .filter(({ slug }) => !slug.includes("/") && !MIGRATE_SLUGS.has(slug))
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

/** The Migrate group's pages in sidebar order, keyed as the raw page glob keys them. */
export const MIGRATE_ORDER: readonly string[] = MIGRATE.map((entry) =>
  pageKey(entry.slug),
);

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
