/// <reference types="vitest/globals" />

/**
 * Nothing under `src/lib` may take part in an import cycle.
 *
 * A cycle between modules that build values at module scope is not the
 * harmless kind. When `zone-readout.ts` and `zone-filter.ts` imported each
 * other, and `zone-filter` built its icon strings at load time, whichever of the
 * two loaded second was still initialising when the first read from it:
 *
 *     ReferenceError: Cannot access 'ICON_STROKE' before initialization
 *
 * Every unit test passed through it, because a test file importing
 * `zone-filter` first happens to establish the one order that works. Only a
 * chunk that reached `zone-readout` first — the tooltip path — actually broke.
 * So this is a source scan rather than an import: it does not depend on the
 * order any one test happens to load things in.
 *
 * The scan covers every module under `src/lib`, not only the zone ones, and
 * follows edges wherever they lead — `~/components`, `~/data`, `~/generated`.
 * The fix for that cycle moved `ICON_STROKE` into `widget-ui.ts`, so the graph
 * now runs through a module outside the `zone-*` family; a scan that stopped
 * at the family's edge could not see the next cycle through it.
 *
 * Two kinds of edge are left out, because neither can leave a binding
 * uninitialised: `import type` / `export type`, which the compiler erases, and
 * dynamic `import()`, which does not run until it is called. A mixed
 * `import { type X, y }` still counts — `y` is real.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsOf, listFiles, resolveLocal, SRC } from "../test/import-graph";

const LIB = path.join(SRC, "lib");

/** Modules whose own imports can run code at load time. */
const isModule = (file: string) =>
  /\.tsx?$/.test(file) && !file.endsWith(".d.ts");

/** Runtime edges out of `file` to other local modules. */
function edgesOf(file: string): string[] {
  const out: string[] = [];
  for (const { specifier, kind } of importsOf(file)) {
    if (kind === "type" || kind === "dynamic") continue;
    const target = resolveLocal(file, specifier);
    if (target && isModule(target)) out.push(target);
  }
  return out;
}

describe("src/lib module graph", () => {
  it("has no import cycles", () => {
    const roots = listFiles(LIB, [".ts", ".tsx"]).filter(
      (file) => isModule(file) && !file.includes(".test."),
    );
    expect(roots.length).toBeGreaterThan(50);

    const cycles: string[] = [];
    const state = new Map<string, "open" | "done">();
    const walk = (node: string, trail: string[]): void => {
      if (state.get(node) === "done") return;
      if (state.get(node) === "open") {
        cycles.push(
          [...trail.slice(trail.indexOf(node)), node]
            .map((file) => path.relative(SRC, file))
            .join(" -> "),
        );
        return;
      }
      state.set(node, "open");
      for (const next of edgesOf(node)) walk(next, [...trail, node]);
      state.set(node, "done");
    };
    for (const root of roots) walk(root, []);

    expect(cycles).toEqual([]);
  });
});
