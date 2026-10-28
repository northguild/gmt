/**
 * Where a docs page's Markdown twin is served: `/gmt/<slug>.md`.
 *
 * One rule for the twin route (`src/pages/[...slug].md.ts`) and the `<link rel="alternate">` that
 * points at it. A page with a `slug:` in its frontmatter (the generated reference, its index pages
 * included) is served at that slug, so `reference/workforce/index.mdx` has its twin at
 * `reference/workforce.md`. Any other page is served at its path under `content/docs/`, so
 * `guides/index.mdx` has its twin at `guides/index.md` and the home page at `index.md`.
 */
import { stripFrontmatter } from "./page-markdown";

/** A file's path relative to `content/docs/`, without its extension. */
export function docsRelPath(path: string): string {
  return path.replace(/^.*\/content\/docs\//, "").replace(/\.(md|mdx)$/, "");
}

/** The twin's path without `.md`, from the page's file path and its frontmatter `slug:`. */
export function markdownTwinSlug(filePath: string, slug?: string): string {
  return slug ?? docsRelPath(filePath);
}

/**
 * Each page's twin path without `.md`, keyed by its path under `content/docs/`, from the raw
 * sources an `import.meta.glob(…, { query: "?raw" })` returns.
 */
export function markdownTwinSlugs(
  raw: Record<string, string>,
): Map<string, string> {
  return new Map(
    Object.entries(raw).map(([path, source]): [string, string] => [
      docsRelPath(path),
      markdownTwinSlug(path, stripFrontmatter(source).data.slug),
    ]),
  );
}
