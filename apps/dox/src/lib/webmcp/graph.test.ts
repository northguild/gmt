/**
 * What the WebMCP code is allowed to reach.
 *
 * `offer.ts` ships in every tool page's entry chunk, so it reaches `model-context.ts` and nothing
 * else. The rest of `webmcp/**` runs only when a browser offers WebMCP; it must stay free of the
 * chat's SDK and of widget code. `lib/widget-mount.ts` is allowed: it holds the shared
 * `WidgetLoadError` and imports nothing. A `.module.css` is banned because `pruneWidgetCss` counts a
 * preload chunk that names a widget's classes as a use.
 */
import path from "node:path";
import {
  importsOf,
  listFiles,
  resolveLocal,
  SRC,
} from "../../test/import-graph";

const WEBMCP = path.join(SRC, "lib/webmcp");

function reachableFrom(entry: string) {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const { specifier } of importsOf(file)) {
      const resolved = resolveLocal(file, specifier);
      if (resolved) queue.push(resolved);
      else bare.add(specifier);
    }
  }
  return { files, bare };
}

const rel = (file: string) => path.relative(SRC, file);

describe("the WebMCP import graph", () => {
  it("lets offer.ts reach model-context.ts and nothing else", () => {
    const { files, bare } = reachableFrom(path.join(WEBMCP, "offer.ts"));
    expect([...files].map(rel).sort()).toEqual([
      "lib/webmcp/model-context.ts",
      "lib/webmcp/offer.ts",
    ]);
    expect([...bare]).toEqual([]);
  });

  it("keeps the chat SDK, React, the chat island, mounts and widget CSS out of webmcp/**", () => {
    const entries = listFiles(WEBMCP, [".ts"]).filter(
      (f) => !f.includes(".test."),
    );
    expect(entries.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const entry of entries) {
      const { files, bare } = reachableFrom(entry);
      for (const name of bare) {
        if (
          name === "ai" ||
          name.startsWith("@ai-sdk/") ||
          name === "react" ||
          name.startsWith("react/") ||
          name === "react-dom"
        ) {
          offenders.push(`${rel(entry)} -> ${name}`);
        }
      }
      for (const file of files) {
        const r = rel(file);
        if (
          r.startsWith("components/ask/") ||
          (/-mount\.tsx?$/.test(r) && r !== "lib/widget-mount.ts") ||
          r.endsWith(".module.css")
        ) {
          offenders.push(`${rel(entry)} -> ${r}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps ai out of dox-tool-schemas.ts", () => {
    const { bare } = reachableFrom(path.join(SRC, "lib/dox-tool-schemas.ts"));
    expect(
      [...bare].filter((name) => name === "ai" || name.startsWith("@ai-sdk/")),
    ).toEqual([]);
  });
});
