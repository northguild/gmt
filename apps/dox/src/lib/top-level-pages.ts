/**
 * The "Start here" pages both `llms.txt` and `llms-full.txt` list. The page
 * modules keep their own `import.meta.glob` (Vite resolves it per module) and
 * pass the resulting raw-source map in.
 */

/** Top-level pages that lead, in this order; any other follows alphabetically. */
const START_ORDER = ["index", "why-gmt", "upstream", "core-rules", "install"];

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
