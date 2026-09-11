/**
 * Every guide file under `src/content/docs/guides/`, loaded through Vite.
 *
 * The parsing lives in `guide-source-parse.ts`; this module is only the glob
 * that feeds it. Keeping them apart is load-bearing, not tidiness: the glob is
 * evaluated at module scope, so anything importing *this* file must run under
 * Vite. `scripts/build-corpus-counts.ts` runs under plain Node and imports the
 * parse half directly.
 */
import { toGuideSource, type GuideSource } from "./guide-source-parse";

export type { GuideSource } from "./guide-source-parse";

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

/**
 * DOX-C1 (#137) — every guide file under `src/content/docs/guides/`, parsed
 * from the build-time glob import above.
 */
export function loadGuideSources(): GuideSource[] {
  return Object.entries(RAW).map(([path, raw]) => toGuideSource(path, raw));
}
