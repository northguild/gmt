/**
 * Reading this app's import graph from source, for the tests that guard it.
 *
 * Shared by `lib/client-graph.test.ts` (nothing a browser loads may reach the
 * TypeScript compiler) and `lib/lib-module-graph.test.ts` (no import cycles).
 * Both scan text rather than importing modules, so neither depends on the
 * order any one test happens to load things in — and both need the same
 * resolution of `~/`, extensionless and `index.ts` specifiers, which is why it
 * lives here once.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** `apps/dox/src`, which `~/` resolves against (see `tsconfig.json`). */
export const SRC = path.resolve(import.meta.dirname, "..");

/**
 * How a module is imported, which decides what the import can do at runtime:
 *
 * - `static` — `import { x } from "…"`, `export { x } from "…"`: evaluated
 *   before the importer's body runs, so it can take part in a cycle.
 * - `type` — `import type` / `export type`: erased at compile time, so it
 *   never loads anything.
 * - `side-effect` — `import "…"`: evaluated like a static import, with no
 *   bindings.
 * - `dynamic` — `import("…")`: deferred until called, so it cannot leave a
 *   binding uninitialised when the importer's body runs, but still pulls the
 *   module into the bundle.
 */
export type ImportKind = "static" | "type" | "side-effect" | "dynamic";

export interface ImportRef {
  specifier: string;
  kind: ImportKind;
}

/** Files that can themselves import something. */
const CODE = [".ts", ".tsx", ".mts", ".js", ".mjs", ".astro"];

export function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * Not optional: several modules *document* imports in prose — `client-graph`
 * names `typescript`, and `curated-timezones.ts` explains at length why
 * `build-utils.ts` importing it is a hazard. Without this the scan reports
 * every such docstring as an import, which it did on its first run.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

/* The clause between `import`/`export` and `from` is only ever names, braces,
   commas, `*` and `as` — never `=`, a quote or a paren — so matching just those
   characters keeps one statement's match from running on into the next. */
const FROM =
  /\b(import|export)\s+(type\s+)?[\w$\s{},*]*?\bfrom\s+["']([^"']+)["']/g;
const SIDE_EFFECT = /^\s*import\s+["']([^"']+)["']/gm;
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Every import in a source file, with how it is imported. */
export function importsOf(file: string): ImportRef[] {
  if (!CODE.some((ext) => file.endsWith(ext))) return [];
  const source = stripComments(readFileSync(file, "utf8"));
  const refs: ImportRef[] = [];
  for (const match of source.matchAll(FROM)) {
    refs.push({
      specifier: match[3] as string,
      kind: match[2] ? "type" : "static",
    });
  }
  for (const match of source.matchAll(SIDE_EFFECT)) {
    refs.push({ specifier: match[1] as string, kind: "side-effect" });
  }
  for (const match of source.matchAll(DYNAMIC)) {
    refs.push({ specifier: match[1] as string, kind: "dynamic" });
  }
  return refs;
}

/** Resolve a local specifier to a real file, or null if it is a package. */
export function resolveLocal(
  fromFile: string,
  specifier: string,
): string | null {
  let base: string;
  if (specifier.startsWith("~/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // a bare package specifier
  }

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.astro`,
    path.join(base, "index.ts"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep trying
    }
  }
  return null;
}
