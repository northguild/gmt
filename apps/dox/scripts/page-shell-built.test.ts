import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { PAGE_SHELL_SCRIPTS, pageShellGroup } from "../src/lib/page-shell";
import { distDirOrSkip } from "./dist-dir";

/**
 * The scripts on every page ship as one `page-shell` chunk, and no page gains code from it.
 * Reads the built pages and the client chunk graph the build recorded
 * (`src/generated/client-chunks.json`, written by `recordClientChunks`). Needs a build; returns
 * early without one and throws under `DOX_DIST_REQUIRED`. Only synchronous reads, so nothing to
 * tear down.
 */

interface Chunk {
  modules: string[];
  moduleImports: Record<string, string[]>;
  imports: string[];
  dynamicImports: string[];
  isEntry: boolean;
  facade: string | null;
}
type Graph = Record<string, Chunk>;

const GLOBE_DIR = "apps/dox/src/lib/globe";
const isShellScript = pageShellGroup().test;

interface Built {
  graph: Graph;
  /** Page path (under dist/gmt) to the `_astro/` chunks its `<script src>` tags load. */
  pages: Map<string, string[]>;
}

/** Every built page's entry scripts and the recorded graph, or `null` with no build. */
function built(): Built | null {
  const dist = distDirOrSkip();
  if (dist === null) return null;
  const root = join(dist, "gmt");
  const graphPath = join(
    import.meta.dirname,
    "../src/generated/client-chunks.json",
  );
  if (!existsSync(graphPath)) {
    throw new Error(
      `${graphPath} is missing: rebuild with \`pnpm --filter dox run build\`.`,
    );
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8")) as Graph;
  const pages = new Map<string, string[]>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "_astro" || entry.name === "pagefind") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".html")) {
        const html = readFileSync(path, "utf8");
        const files = [
          ...html.matchAll(/\bsrc="[^"]*?\/(_astro\/[^"/]+\.js)"/g),
        ]
          .map((m) => m[1]!)
          .filter((file) => file in graph);
        pages.set(relative(root, path), [...new Set(files)]);
      }
    }
  };
  walk(root);
  return { graph, pages };
}

/** The chunks reached from `entries`: static imports only, or dynamic ones too. */
function reach(graph: Graph, entries: string[], dynamic: boolean): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file) || !(file in graph)) continue;
    seen.add(file);
    stack.push(...graph[file]!.imports);
    if (dynamic) stack.push(...graph[file]!.dynamicImports);
  }
  return seen;
}

/** The entry chunks whose facade is one of the shell's component scripts. */
function shellEntries(graph: Graph): string[] {
  return Object.keys(graph).filter(
    (file) => graph[file]!.isEntry && isShellScript(graph[file]!.facade ?? ""),
  );
}

describe("the page shell in the built site", () => {
  it("lists exactly the component scripts that every page loads", () => {
    const site = built();
    if (site === null) return;
    const facadeOf = (file: string) => site.graph[file]!.facade ?? "";
    const component = (file: string) =>
      facadeOf(file).includes("?astro&type=script");
    let common = null as Set<string> | null;
    for (const [page, files] of site.pages) {
      const here = new Set(files.filter(component).map(facadeOf));
      common =
        common === null
          ? here
          : new Set([...common].filter((f) => here.has(f)));
      const missing = shellEntries(site.graph)
        .map(facadeOf)
        .filter((facade) => !here.has(facade));
      expect(missing, `${page} lacks a listed shell script`).toEqual([]);
    }
    const listed = [...(common ?? [])].filter(isShellScript);
    expect(
      [...(common ?? [])].filter((f) => !isShellScript(f)),
      "a script on every page is missing from PAGE_SHELL_SCRIPTS",
    ).toEqual([]);
    expect(listed).toHaveLength(PAGE_SHELL_SCRIPTS.length);
  });

  it("ships one page-shell chunk, reached by every shell entry", () => {
    const site = built();
    if (site === null) return;
    const shells = Object.keys(site.graph).filter((f) =>
      f.startsWith("_astro/page-shell."),
    );
    expect(shells).toHaveLength(1);
    for (const entry of shellEntries(site.graph)) {
      expect(
        reach(site.graph, [entry], false),
        `${entry} does not import the shell`,
      ).toContain(shells[0]);
    }
  });

  it("holds only code from the shell entries' static imports", () => {
    const site = built();
    if (site === null) return;
    const shell = Object.keys(site.graph).find((f) =>
      f.startsWith("_astro/page-shell."),
    )!;
    const edges = new Map(
      Object.values(site.graph).flatMap((chunk) =>
        Object.entries(chunk.moduleImports),
      ),
    );
    const roots = shellEntries(site.graph).map(
      (file) => site.graph[file]!.facade!,
    );
    const closure = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (closure.has(id)) continue;
      closure.add(id);
      stack.push(...(edges.get(id) ?? []));
    }
    for (const id of site.graph[shell]!.modules) {
      expect(
        closure.has(id),
        `${id} is in the shell but no shell entry imports it`,
      ).toBe(true);
    }
  });

  it("is reached only by pages that carry all four shell scripts", () => {
    const site = built();
    if (site === null) return;
    const shell = Object.keys(site.graph).find((f) =>
      f.startsWith("_astro/page-shell."),
    )!;
    const entries = shellEntries(site.graph);
    for (const [page, files] of site.pages) {
      if (!reach(site.graph, files, true).has(shell)) continue;
      expect(
        entries.filter((e) => !files.includes(e)),
        `${page} reaches page-shell without every shell script`,
      ).toEqual([]);
    }
  });

  it("loads no globe code on a reference page", () => {
    const site = built();
    if (site === null) return;
    for (const [page, files] of site.pages) {
      if (!page.startsWith("reference/")) continue;
      const hit = [...reach(site.graph, files, true)]
        .flatMap((f) => site.graph[f]!.modules)
        .find((id) => id.startsWith(GLOBE_DIR));
      expect(hit, `${page} reaches ${hit}`).toBeUndefined();
    }
  });
});
