/**
 * What the MCP server may reach. Lazy loading is the point: a static import of any tool module
 * would evaluate every tool when the Worker starts, which the Free plan's CPU limit cannot afford.
 * The SDK stays out of the browser.
 */
import path from "node:path";
import {
  importsOf,
  listFiles,
  resolveLocal,
  SRC,
} from "../../test/import-graph";

const WORKER = path.resolve(SRC, "../worker");
const rel = (file: string) => path.relative(SRC, file);

function reachableFrom(entry: string) {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const { specifier, kind } of importsOf(file)) {
      if (kind === "dynamic" || kind === "type") continue;
      const resolved = resolveLocal(file, specifier);
      if (resolved) queue.push(resolved);
      else bare.add(specifier);
    }
  }
  return { files, bare };
}

describe("the MCP import graph", () => {
  it.each([path.join(SRC, "lib/mcp/server.ts"), path.join(WORKER, "mcp.ts")])(
    "keeps %s off every tool module, the chat SDK, React, mounts and CSS",
    (entry) => {
      const { files, bare } = reachableFrom(entry);
      const offenders: string[] = [];
      for (const name of bare) {
        if (
          name === "ai" ||
          name.startsWith("@ai-sdk/") ||
          name === "react" ||
          name.startsWith("react/") ||
          name === "react-dom"
        ) {
          offenders.push(name);
        }
      }
      for (const file of files) {
        const r = rel(file);
        if (
          r.startsWith("lib/webmcp/tools/") ||
          r.startsWith("components/") ||
          (/-mount\.tsx?$/.test(r) && r !== "lib/widget-mount.ts") ||
          r.endsWith(".css")
        ) {
          offenders.push(r);
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("keeps the MCP SDK out of the pages, components and WebMCP", () => {
    const dirs = ["components", "pages", "lib/webmcp"].map((d) =>
      path.join(SRC, d),
    );
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of listFiles(dir, [".ts", ".tsx", ".astro"])) {
        if (file.includes(".test.")) continue;
        for (const { specifier } of importsOf(file)) {
          const resolved = resolveLocal(file, specifier);
          if (
            specifier.startsWith("@modelcontextprotocol/") ||
            (resolved && rel(resolved).startsWith("lib/mcp/"))
          ) {
            offenders.push(`${rel(file)} -> ${specifier}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
