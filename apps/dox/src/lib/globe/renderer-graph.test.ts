/// <reference types="vitest/globals" />

/**
 * The two renderers must not drag each other's dependencies along (#289).
 *
 * The whole point of loading a backend through a dynamic `import()` is that a
 * browser downloads one of them, not both: a WebGPU browser should never fetch
 * `d3-geo`, and a browser falling back to canvas-2D should never fetch `earcut`
 * or the shader source. One stray static import at the top of `engine.ts` or a
 * shared helper quietly undoes that, and the page still works, so nothing else
 * would notice.
 *
 * It also guards the promise in `canvas2d/`'s header that the fallback is
 * removable in one step: if anything outside that directory imports d3-geo,
 * deleting the directory stops being enough.
 *
 * A static source walk, like `components/ask/widget-graph.test.ts`, so it fails
 * on the commit that regresses rather than waiting for a build.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..", "..");
const GLOBE = path.join(SRC, "lib/globe");

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
function valueImportsOf(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const statement =
    /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s+["']([^"']+)["']/gm;
  for (const match of code.matchAll(statement)) {
    if (match[2]) continue; // `import type` / `export type`
    specifiers.push(match[4]);
  }
  for (const match of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveLocal(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("~/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith("."))
    base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
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

/** Everything reachable from `entry` by static value imports. */
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
  return {
    files: [...files].map((file) => path.relative(SRC, file)),
    bare: [...bare],
  };
}

/**
 * The package only the canvas-2D fallback may reach.
 *
 * Just `d3-geo`, the projection library the GPU path replaced with
 * `camera.ts`. `topojson-client` and `world-atlas` are deliberately *not* here:
 * they are the land data and its decoder, which both renderers need — the
 * fallback through `geoPath`, the GPU path through `land.ts`.
 */
const FALLBACK_ONLY = ["d3-geo"];

/** The packages only the WebGPU renderer is allowed to reach. */
const GPU_ONLY = ["earcut"];

describe("the WebGPU renderer's static graph", () => {
  const { files, bare } = staticGraph(
    path.join(GLOBE, "webgpu/renderer-webgpu.ts"),
  );

  it("reaches the shaders, so the walk is real", () => {
    expect(files).toContain("lib/globe/webgpu/shaders.ts");
    expect(files).toContain("lib/globe/land.ts");
  });

  it("pulls in none of the fallback's geo packages", () => {
    expect(bare.filter((name) => FALLBACK_ONLY.includes(name))).toEqual([]);
  });

  it("never reaches the canvas-2D renderer", () => {
    expect(
      files.filter((file) => file.startsWith("lib/globe/canvas2d/")),
    ).toEqual([]);
  });
});

describe("the canvas-2D renderer's static graph", () => {
  const { files, bare } = staticGraph(
    path.join(GLOBE, "canvas2d/renderer-canvas2d.ts"),
  );

  it("reaches d3-geo, so the walk is real", () => {
    expect(bare).toContain("d3-geo");
  });

  it("pulls in none of the GPU-only packages", () => {
    expect(bare.filter((name) => GPU_ONLY.includes(name))).toEqual([]);
  });

  it("never reaches the WebGPU renderer or its shaders", () => {
    expect(
      files.filter((file) => file.startsWith("lib/globe/webgpu/")),
    ).toEqual([]);
  });
});

describe("the engine", () => {
  const { files, bare } = staticGraph(path.join(GLOBE, "engine.ts"));

  it("reaches neither backend statically — both are dynamic imports", () => {
    expect(
      files.filter(
        (file) =>
          file.startsWith("lib/globe/webgpu/") ||
          file.startsWith("lib/globe/canvas2d/"),
      ),
    ).toEqual([]);
  });

  it("pulls in no renderer-specific package of its own", () => {
    expect(
      bare.filter((name) => [...FALLBACK_ONLY, ...GPU_ONLY].includes(name)),
    ).toEqual([]);
  });
});

describe("the fallback stays deletable in one step", () => {
  /** Every `.ts` file under `lib/globe/`, excluding tests. */
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) return [];
      return [full];
    });
  }

  it("keeps d3-geo inside canvas2d/", () => {
    const offenders = walk(GLOBE)
      .filter((file) => !path.relative(GLOBE, file).startsWith("canvas2d"))
      .filter((file) =>
        valueImportsOf(readFileSync(file, "utf8")).some((specifier) =>
          FALLBACK_ONLY.includes(specifier),
        ),
      )
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("has exactly one reference to the fallback module, in the engine", () => {
    /* The single `import("./canvas2d/renderer-canvas2d")` is what a deletion has
       to remove alongside the directory. More than one means more places to
       find. */
    const referrers = walk(GLOBE)
      // Comments stripped: several files mention the fallback in prose, and
      // what matters is who actually loads it.
      .filter((file) =>
        /import\(\s*["']\.\/canvas2d\/renderer-canvas2d["']\s*\)/.test(
          stripComments(readFileSync(file, "utf8")),
        ),
      )
      .map((file) => path.relative(GLOBE, file));
    expect(referrers).toEqual(["engine.ts"]);
  });
});
