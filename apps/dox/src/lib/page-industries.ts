/**
 * The industry tags a docs page shows under its title. A page's own `industries` frontmatter
 * wins; a directory index that declares none shows the union of the tags of the pages under its
 * directory, Core first, so the index cannot drift as pages come and go; any other page has none.
 *
 * The route middleware, the Markdown twins and the coverage test all resolve a page here, so the
 * tag under a title and the `Industry:` line of its twin cannot disagree.
 */

import { INDUSTRY_TAG_IDS } from "./industry-tags";
import { docsRelPath } from "./md-twin";
import { stripFrontmatter } from "./page-markdown";

/** One docs entry, as the middleware and the twins read it. */
export interface PageEntry {
  /** The route id: `guides/index`, `reference/plain/calculate/add`. */
  id: string;
  /** The `industries` frontmatter, when the page declares it. */
  industries?: readonly string[];
  template?: string;
}

/**
 * The directory a page would list. Starlight keys a folder's index by the folder (`guides`), and
 * a file path names it `guides/index`; both give `guides`. The site root has no directory.
 */
function directoryOf(id: string): string {
  return id === "index" ? "" : id.replace(/\/index$/, "");
}

/**
 * Whether the page is an index over other pages: another entry's id starts with `<dir>/`, where
 * `<dir>` is the id without a trailing `/index`.
 */
export function isDirectoryIndex(
  id: string,
  all: readonly PageEntry[],
): boolean {
  const dir = directoryOf(id);
  if (dir === "") return false;
  return all.some((entry) => entry.id !== id && entry.id.startsWith(`${dir}/`));
}

/**
 * The tags a page shows: `own` when it has any; for a directory index, the union of the own tags
 * of every entry under its directory at any depth, in `INDUSTRY_TAG_IDS` order (Core first);
 * otherwise none.
 */
export function pageIndustries(
  id: string,
  own: readonly string[] | undefined,
  all: readonly PageEntry[],
): string[] {
  if (own && own.length > 0) return [...own];
  if (!isDirectoryIndex(id, all)) return [];
  const prefix = `${directoryOf(id)}/`;
  const found = new Set(
    all
      .filter((entry) => entry.id !== id && entry.id.startsWith(prefix))
      .flatMap((entry) => entry.industries ?? []),
  );
  return INDUSTRY_TAG_IDS.filter((tag) => found.has(tag));
}

/** The ids a raw frontmatter list names: `[core, workforce]` gives both. */
function listIds(value: string | undefined): string[] {
  return (value ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Every page's entry, from the raw sources an `import.meta.glob(…, { query: "?raw" })` returns.
 * The id is the frontmatter `slug:` when there is one, else the path under `content/docs/`, which
 * is how Starlight names a route.
 */
export function pageEntries(raw: Record<string, string>): {
  rel: string;
  entry: PageEntry;
}[] {
  return Object.entries(raw).map(([path, source]) => {
    const { data } = stripFrontmatter(source);
    const rel = docsRelPath(path);
    return {
      rel,
      entry: {
        id: data.slug ?? rel,
        industries: data.industries ? listIds(data.industries) : undefined,
        template: data.template,
      },
    };
  });
}

/**
 * The tags each page shows, as the raw-frontmatter text the Markdown export reads (`[core,
 * workforce]`), keyed by the page's path under `content/docs/`. A page with no tag is absent.
 */
export function industriesByPath(
  raw: Record<string, string>,
): Map<string, string> {
  const pages = pageEntries(raw);
  const all = pages.map(({ entry }) => entry);
  const out = new Map<string, string>();
  for (const { rel, entry } of pages) {
    const tags = pageIndustries(entry.id, entry.industries, all);
    if (tags.length > 0) out.set(rel, `[${tags.join(", ")}]`);
  }
  return out;
}
