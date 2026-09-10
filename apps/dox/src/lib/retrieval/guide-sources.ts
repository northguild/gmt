/** One guide file's raw content, already stripped to frontmatter + body —
 * everything `guide-chunks.ts` needs and nothing it has to re-derive from a
 * file path. Kept separate from the glob import so the chunking logic
 * itself stays a pure function, testable without touching disk. */
export interface GuideSource {
  /** Content-collection route, e.g. "/guides/core-date-operations/formatting/". */
  route: string;
  /** Frontmatter `title` — Starlight renders this as the page's implicit H1,
   * so it's the label for the guide's first (heading-less) section. */
  title: string;
  /** Markdown body with frontmatter already removed. */
  body: string;
}

// Vite's own glob import, not `node:fs` — this file gets called from
// `src/pages/retrieval-chunks.json.ts`, an Astro endpoint that Astro bundles
// into `dist/.prerender/chunks/*.mjs` at a path that bears no relation to
// this source file's own location, so a runtime `node:fs` walk relative to
// `import.meta.dirname` breaks (verified 2026-09-09 — ENOENT at build time).
// `import.meta.glob` is resolved statically at build time against *this
// file's* real path, the same fix `src/pages/llms.txt.ts` already uses for
// the identical problem.
const RAW = import.meta.glob("../../content/docs/guides/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

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

function routeForPath(globPath: string): string {
  const rel = globPath
    .replace(/^.*\/content\/docs\/guides\//, "")
    .replace(/\.(mdx?|md)$/, "");
  const segments = rel.split("/").filter((s) => s !== "index");
  return `/guides/${segments.length > 0 ? segments.join("/") + "/" : ""}`;
}

/**
 * DOX-C1 (#137) — every guide file under `src/content/docs/guides/`, parsed
 * from the build-time glob import above.
 */
export function loadGuideSources(): GuideSource[] {
  return Object.entries(RAW).map(([path, raw]) => {
    const fmMatch = raw.match(FRONTMATTER_RE);
    const frontmatter = fmMatch?.[1] ?? "";
    const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;
    return {
      route: routeForPath(path),
      title: extractTitle(frontmatter),
      body,
    };
  });
}
