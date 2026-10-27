/**
 * Where a docs page's Markdown twin is served: `/gmt/<slug>.md`.
 *
 * One rule for the twin route (`src/pages/[...slug].md.ts`) and the `<link rel="alternate">` that
 * points at it. A page with a `slug:` in its frontmatter (the generated reference) is served at
 * that slug; any other page is served at its path under `content/docs/`, so `guides/index.mdx`
 * has its twin at `guides/index.md` and the home page at `index.md`.
 */

/** A file's path relative to `content/docs/`, without its extension. */
export function docsRelPath(path: string): string {
  return path.replace(/^.*\/content\/docs\//, "").replace(/\.(md|mdx)$/, "");
}

/**
 * The twin's path without `.md`, from the page's route id and its file path. A page whose id is not
 * the one its path gives has a `slug:`, and the id is that slug.
 */
export function markdownTwinSlug(id: string, filePath: string): string {
  const rel = docsRelPath(filePath);
  const pathId = rel.replace(/(?:^|\/)index$/, "");
  return id === pathId || (id === "index" && rel === "index") ? rel : id;
}
