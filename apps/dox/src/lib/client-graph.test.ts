/// <reference types="vitest/globals" />
/**
 * Nothing the browser can reach may import the TypeScript compiler.
 *
 * `scripts/build-utils/build-utils.ts` does `import ts from "typescript"` at its
 * top level. For most of this project's life that was safe purely by accident:
 * its only consumers imported it from Astro *frontmatter*, which runs at build
 * time, so the compiler never entered a client chunk. Nothing enforced it, and
 * `globe-zones.ts` worked around it by duplicating twenty timezone ids rather
 * than risk the import.
 *
 * `DOX-C3b` removes that accident. Mounting a Tier 2 widget from the chat rail
 * means its markup is produced by a client-reachable template function, and a
 * single stray import from one of those into `scripts/` would drag the whole
 * TypeScript compiler into the `/dox` bundle — silently, with no error, just a
 * multi-megabyte chunk.
 *
 * This walks the real import graph from every client entry point. It is a
 * static test with no build step, so it fails on the commit that introduces the
 * problem rather than at some later bundle-size review.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..");
const APP = path.resolve(SRC, "..");

/** Modules that are never shipped to a browser. */
const SERVER_ONLY = new Set([
  // Reads the content collection through import.meta.glob; Node-only by design.
  path.join(SRC, "lib/retrieval/corpus.ts"),
  path.join(SRC, "lib/retrieval/guide-sources.ts"),
]);

const BANNED = ["typescript"];

function listFiles(dir: string, extensions: string[]): string[] {
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
 * Not optional: several modules *document* the banned import in prose — this
 * very file names `typescript`, and `curated-timezones.ts` explains at length
 * why `build-utils.ts` importing it is a hazard. Without this the guard reports
 * every such docstring as a violation, which it did on its first run.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

/** Every `from "..."` / `import("...")` specifier in a source file. */
function importsOf(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolve a relative specifier to a real file, or null if it is a package. */
function resolveLocal(fromFile: string, specifier: string): string | null {
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

/** Walk the graph from `entry`, returning every file and bare specifier seen. */
function reachableFrom(entry: string) {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || SERVER_ONLY.has(file)) continue;
    seen.add(file);

    for (const specifier of importsOf(file)) {
      const resolved = resolveLocal(file, specifier);
      if (resolved) {
        queue.push(resolved);
      } else {
        bare.add(specifier);
      }
    }
  }
  return { files: seen, bare };
}

/* Client entry points: every module under src/lib (widget mounts and their
   helpers all live here) plus every React component in the chat island. */
const ENTRIES = [
  ...listFiles(path.join(SRC, "lib"), [".ts"]),
  ...listFiles(path.join(SRC, "components"), [".tsx"]),
].filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

describe("the client import graph", () => {
  it("has entry points to check", () => {
    expect(ENTRIES.length).toBeGreaterThan(20);
  });

  it("never reaches the TypeScript compiler", () => {
    const offenders: string[] = [];
    for (const entry of ENTRIES) {
      if (SERVER_ONLY.has(entry)) continue;
      const { bare } = reachableFrom(entry);
      for (const banned of BANNED) {
        if (bare.has(banned)) {
          offenders.push(`${path.relative(APP, entry)} → ${banned}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never reaches scripts/, which is where the compiler is imported", () => {
    // Stronger and more durable than banning the package by name: `scripts/` is
    // build tooling, and no client module has any business in it whatever it
    // happens to import today.
    const offenders: string[] = [];
    for (const entry of ENTRIES) {
      if (SERVER_ONLY.has(entry)) continue;
      const { files } = reachableFrom(entry);
      for (const file of files) {
        if (file.startsWith(path.join(APP, "scripts"))) {
          offenders.push(
            `${path.relative(APP, entry)} → ${path.relative(APP, file)}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
