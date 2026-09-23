/**
 * Turning one guide file into a `GuideSource` — the half of guide loading that
 * touches no filesystem and no bundler.
 *
 * `guide-sources.ts` pairs these with `import.meta.glob`, which is a Vite
 * construct: importing that module from plain Node throws, because the glob is
 * evaluated at module scope. `scripts/build-corpus-counts.ts` needs exactly
 * this parsing and none of that, so the pure half lives here and both callers
 * share it. Splitting it is what keeps the generated chunk counts derived from
 * the same code the Worker's corpus is built from, rather than from a second
 * implementation that drifts.
 */
import { stripMdx } from "../page-markdown";

/** One guide file's raw content, already stripped to frontmatter + body —
 * everything `guide-chunks.ts` needs and nothing it has to re-derive from a
 * file path. */
export interface GuideSource {
  /** Content-collection route, e.g. "/guides/core-date-operations/formatting/". */
  route: string;
  /** Frontmatter `title` — Starlight renders this as the page's implicit H1,
   * so it's the label for the guide's first (heading-less) section. */
  title: string;
  /** Markdown body with frontmatter already removed. */
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function extractTitle(frontmatter: string): string {
  // Deliberately simple: one `title: value` line, optionally quoted. Every
  // guide file in this repo uses a plain scalar title (verified 2026-09-09 —
  // none use YAML block/flow scalars for it), so a full YAML parser would be
  // more machinery than the input ever needs.
  const match = frontmatter.match(/^title:\s*(.+)$/m);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

/** Route for a guide or a top-level page: `…/content/docs/guides/a/b.mdx` →
 * `/guides/a/b/`, `…/content/docs/upstream.mdx` → `/upstream/`, and
 * `…/content/docs/index.mdx` → `/`. */
export function routeForPath(globPath: string): string {
  const rel = globPath
    .replace(/^.*\/content\/docs\//, "")
    .replace(/\.(mdx?|md)$/, "");
  const segments = rel.split("/").filter((s) => s !== "index");
  return segments.length > 0 ? `/${segments.join("/")}/` : "/";
}

/** Parse one guide file. `path` need only *end* with its route-bearing tail.
 *
 * `body` is run through `stripMdx` (imports, Starlight component tags,
 * `{gmtVersion}`) so the retrieval corpus never carries the raw MDX that
 * `guide-chunks.ts` would otherwise hand straight to search and the chat
 * model — the same reason `llms.txt.ts` / `[...slug].md.ts` run it before
 * publishing a page's `.md` route. `vars` defaults to `{}`: the two callers
 * that don't have a build-time version handy (`build-corpus-counts.ts` only
 * needs chunk *counts*, unaffected by the substitution) still get the import
 * and component stripping. */
export function toGuideSource(
  path: string,
  raw: string,
  vars: { gmtVersion?: string; values?: Record<string, string> } = {},
): GuideSource {
  const fmMatch = raw.match(FRONTMATTER_RE);
  const frontmatter = fmMatch?.[1] ?? "";
  const rawBody = fmMatch ? raw.slice(fmMatch[0].length) : raw;
  return {
    route: routeForPath(path),
    title: extractTitle(frontmatter),
    body: stripMdx(rawBody, vars),
  };
}
