/// <reference types="vitest/globals" />

/**
 * The zone modules must not import each other in a circle.
 *
 * A cycle here is not the harmless kind. `zone-filter.ts` builds its icon
 * strings at module scope, so when `zone-readout.ts` and `zone-filter.ts`
 * imported each other, whichever loaded second was still initialising when the
 * first read from it:
 *
 *     ReferenceError: Cannot access 'ICON_STROKE' before initialization
 *
 * Every unit test passed through it, because a test file importing
 * `zone-filter` first happens to establish the one order that works. Only a
 * chunk that reached `zone-readout` first — the tooltip path — actually broke.
 * So this is a source scan rather than an import: it does not depend on the
 * order any one test happens to load things in.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const LIB = dirname(fileURLToPath(import.meta.url));

/** `./thing` and `./dir/thing` imports, type-only ones included — a type-only
 *  edge cannot cause a cycle at runtime, but it still makes the graph one a
 *  reader has to hold in their head. */
const IMPORT = /from\s+"(\.\.?\/[^"]+)"/g;

function localImports(file: string): string[] {
  const source = readFileSync(join(LIB, file), "utf8");
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const target = `${(match[1] as string).replace(/^\.\//, "")}.ts`;
    out.push(target);
  }
  return out;
}

describe("zone module graph", () => {
  it("has no import cycles", () => {
    const files = readdirSync(LIB).filter(
      (f) =>
        f.startsWith("zone-") && f.endsWith(".ts") && !f.includes(".test."),
    );
    expect(files.length).toBeGreaterThan(3);

    const edges = new Map<string, string[]>();
    for (const file of files) {
      edges.set(
        file,
        localImports(file).filter((t) => files.includes(t)),
      );
    }

    const cycles: string[] = [];
    const state = new Map<string, "open" | "done">();
    const walk = (node: string, trail: string[]): void => {
      if (state.get(node) === "done") return;
      if (state.get(node) === "open") {
        cycles.push([...trail.slice(trail.indexOf(node)), node].join(" -> "));
        return;
      }
      state.set(node, "open");
      for (const next of edges.get(node) ?? []) walk(next, [...trail, node]);
      state.set(node, "done");
    };
    for (const file of files) walk(file, []);

    expect(cycles).toEqual([]);
  });
});
