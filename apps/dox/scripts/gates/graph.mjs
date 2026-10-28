/**
 * The import graph the gate runner selects pages with (`select.mjs` takes its output).
 *
 * A page is a `src/content/docs/**.{md,mdx}` or `src/pages/**.astro` file. Its closure is every file
 * reached from it through a static `import … from "…"`, a dynamic `import("…")` or a CSS
 * `@import`, resolving relative paths and the `~/` alias (`src/`). Imports of
 * `@northguild/gmt/<namespace>/<module>` are kept apart as the library modules a page reaches.
 *
 * Every path is relative to the repository root, with forward slashes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = [
  ".mdx",
  ".astro",
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  ".css",
];
const RESOLVE_EXTENSIONS = [...SOURCE_EXTENSIONS, ".json"];
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bexport\s+[^"'()]*?\s+from\s+["']([^"']+)["']/g,
  /@import\s+(?:url\()?["']([^"']+)["']/g,
];
const GMT_MODULE = /^@northguild\/gmt\/([^/]+\/[^/]+)$/;

/** Every file under `dir` that `accept` takes, recursively, as absolute paths. */
function walk(dir, accept) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, accept));
    else if (accept(entry.name)) out.push(full);
  }
  return out;
}

/** The specifiers an `.mdx`, `.astro`, script or stylesheet source imports. */
export function importsOf(source) {
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

/**
 * A page's site path: `docs/<x>.mdx` (or `.md`) is `/<x>/`, `index.mdx` its folder, `dox.astro`
 * is `/dox/`.
 */
export function sitePathOf(relativeToRoot) {
  const docs = /^apps\/dox\/src\/content\/docs\/(.+)\.mdx?$/.exec(
    relativeToRoot,
  );
  if (docs) {
    const trimmed = docs[1].replace(/(?:^|\/)index$/, "");
    return trimmed === "" ? "/" : `/${trimmed}/`;
  }
  const page = /^apps\/dox\/src\/pages\/(.+)\.astro$/.exec(relativeToRoot);
  if (page) {
    if (page[1].includes("[")) return null;
    const trimmed = page[1].replace(/(?:^|\/)index$/, "");
    return trimmed === "" ? "/" : `/${trimmed}/`;
  }
  return null;
}

/**
 * @param {string} repoRoot absolute path of the repository root
 * @returns {{ path: string, file: string, closure: string[], gmt: string[] }[]}
 */
export function buildPages(repoRoot) {
  const dox = path.join(repoRoot, "apps/dox");
  const src = path.join(dox, "src");
  const rel = (abs) => path.relative(repoRoot, abs).split(path.sep).join("/");
  const direct = new Map();

  function resolveSpecifier(from, specifier) {
    let base;
    if (specifier.startsWith("~/")) base = path.join(src, specifier.slice(2));
    else if (specifier.startsWith("."))
      base = path.resolve(path.dirname(from), specifier);
    else return null;
    const candidates = [
      base,
      ...RESOLVE_EXTENSIONS.map((ext) => base + ext),
      ...RESOLVE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
    ];
    return (
      candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
    );
  }

  function edgesOf(file) {
    const known = direct.get(file);
    if (known) return known;
    const edges = { files: [], gmt: [] };
    direct.set(file, edges);
    if (!SOURCE_EXTENSIONS.includes(path.extname(file))) return edges;
    for (const specifier of importsOf(readFileSync(file, "utf8"))) {
      const gmt = GMT_MODULE.exec(specifier);
      if (gmt) {
        edges.gmt.push(gmt[1]);
        continue;
      }
      const resolved = resolveSpecifier(file, specifier);
      if (resolved) edges.files.push(resolved);
    }
    return edges;
  }

  const pageFiles = [
    ...walk(path.join(src, "content/docs"), (n) => /\.mdx?$/.test(n)),
    ...walk(path.join(src, "pages"), (n) => n.endsWith(".astro")),
  ];
  const pages = [];
  for (const file of pageFiles.sort()) {
    const sitePath = sitePathOf(rel(file));
    if (!sitePath) continue;
    const seen = new Set();
    const gmt = new Set();
    const stack = [file];
    while (stack.length > 0) {
      const next = stack.pop();
      if (seen.has(next)) continue;
      seen.add(next);
      const edges = edgesOf(next);
      for (const m of edges.gmt) gmt.add(m);
      stack.push(...edges.files);
    }
    pages.push({
      path: sitePath,
      file: rel(file),
      closure: [...seen].map(rel).sort(),
      gmt: [...gmt].sort(),
    });
  }
  return pages;
}
