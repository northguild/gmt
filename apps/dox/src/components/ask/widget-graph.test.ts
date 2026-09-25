/// <reference types="vitest/globals" />
/**
 * The chat's first download must not carry the widgets.
 *
 * `widget-registry.ts` once imported each widget's template statically from
 * the same module as its mount. Those modules import the Temporal polyfill and
 * each widget's logic at the top, so every mount and the polyfill sat in the
 * `/dox` chunk and every `load()` loaded nothing new — while the registry's own
 * comment said the opposite. Nothing tested it.
 *
 * This walks the *static value* imports from the chat's island entry. Type-only
 * imports are erased at build time and dynamic `import()` is the lazy path, so
 * neither is followed. No build step: it fails on the commit that regresses.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../..");
const ENTRY = path.join(SRC, "components/ask/DoxPage.tsx");

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

/** Specifiers of static imports and re-exports that survive to runtime. */
export function valueImportsOf(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const statement =
    /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s+["']([^"']+)["']/gm;
  for (const match of code.matchAll(statement)) {
    if (match[2]) continue; // `import type` / `export type`
    specifiers.push(match[4]);
  }
  // Side-effect imports: `import "x";`
  for (const match of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveLocal(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("~/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
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

function staticGraph(entry: string) {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const specifier of valueImportsOf(readFileSync(file, "utf8"))) {
      const resolved = resolveLocal(file, specifier);
      if (resolved) queue.push(resolved);
      else if (!specifier.startsWith("~/") && !specifier.startsWith(".")) {
        bare.add(specifier);
      }
    }
  }
  return { files, bare };
}

describe("valueImportsOf", () => {
  it("keeps value imports and drops type-only ones", () => {
    expect(
      valueImportsOf(
        [
          'import type { A } from "./a";',
          'import { b, type B } from "./b";',
          'export type { C } from "./c";',
          'import "./d.css";',
          "import {",
          "  e,",
          '} from "./e";',
          'const f = () => import("./f");',
        ].join("\n"),
      ).sort(),
    ).toEqual(["./b", "./d.css", "./e"]);
  });
});

describe("the chat island's static import graph", () => {
  const { files, bare } = staticGraph(ENTRY);
  const relative = [...files].map((file) => path.relative(SRC, file));

  it("reaches the registry, so the walk is real", () => {
    expect(relative).toContain("components/ask/widget-registry.ts");
  });

  it("reaches no widget mount module", () => {
    // `widget-mount.ts` is the contract itself — types, `onceDestroy`, the load
    // error — and carries no widget.
    expect(
      relative.filter(
        (file) => file.endsWith("-mount.ts") && file !== "lib/widget-mount.ts",
      ),
    ).toEqual([]);
  });

  it("reaches no widget logic or library loader", () => {
    const heavy = [
      "lib/gmt-modules.ts",
      "lib/dwell-ledger.ts",
      "lib/free-time-ledger.ts",
      "lib/billing-deadlines.ts",
      "lib/dst-inspector.ts",
      "lib/interval-visualizer.ts",
      "lib/globe.ts",
      "lib/playground-client.ts",
    ];
    expect(relative.filter((file) => heavy.includes(file))).toEqual([]);
  });

  it("never imports the polyfill or gmt's root barrel, which re-exports it", () => {
    expect(
      [...bare].filter(
        (s) => s === "@js-temporal/polyfill" || s === "@northguild/gmt",
      ),
    ).toEqual([]);
  });
});
