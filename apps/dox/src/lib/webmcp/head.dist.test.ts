/**
 * The built site: each tool page carries one WebMCP marker naming its slug, and no other page does,
 * and the stylesheets its tool import would preload are all already linked on the page. The second
 * guards `pruneWidgetCss`: a tool that imported a lib living in another widget's chunk would put
 * that widget's CSS in the preload list, and the page must not depend on a sheet it does not link.
 * Only the tool import's own list is judged, found by walking dynamic imports to the chunk that
 * names the page (through a hop where there is one); the widget's mount lists are not this story's.
 * Reads `dist`, so `test:dist` picks it up.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { distDirOrSkip } from "../../../scripts/dist-dir";

const dist = distDirOrSkip();
const site = path.join(dist ?? "", "gmt");
const SRC = path.resolve(import.meta.dirname, "../..");
const MARKER = /<meta\s+name="gmt-webmcp"\s+content="([^"]*)"/g;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name.endsWith(".html") ? [full] : [];
  });
}

const markersIn = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(MARKER)].map(
    (match) => match[1] as string,
  );

/** What a tool page's chunks say about the stylesheets its tool import would preload. */
export interface ToolPreload {
  /** How many imports of the page's tool chunk were found; 0 means the walk found no tool. */
  found: number;
  /** The `.css` files those imports' preload lists name that the page does not link. */
  unlinked: string[];
}

const IMPORT = /import\(\s*[`"']\.\/([^`"']+\.js)[`"']\s*\)/g;
const MAP_DEPS = /__vite__mapDeps\(\[([\d,\s]*)\]\)/;

/**
 * Walks the dynamic imports from `entries` (chunk names under `_astro/`, read through `read`) to the
 * chunk of the tool for `slug`, found by its `page:` field, and names the stylesheets only that
 * import's preload list asks for. An import's list sits in the chunk that makes the import, so a tool
 * reached through a hop is read from the hop's table. A mount's own imports are walked past, never
 * judged: their sheets are the widget's business, not the tool's.
 */
export function toolImportPreload(
  html: string,
  slug: string,
  entries: string[],
  read: (name: string) => string | undefined,
): ToolPreload {
  const isTool = new RegExp(`page:\\s*[\`"']${slug}[\`"']`);
  const result: ToolPreload = { found: 0, unlinked: [] };
  const seen = new Set<string>();
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const code = read(name);
    if (code === undefined) return;
    const table = /m\.f=\[([^\]]*)\]/.exec(code)?.[1] ?? "";
    const files = [...table.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
    for (const match of code.matchAll(IMPORT)) {
      const child = match[1] as string;
      const childCode = read(child);
      if (childCode === undefined) continue;
      if (!isTool.test(childCode)) {
        visit(child);
        continue;
      }
      result.found += 1;
      const indices = MAP_DEPS.exec(code.slice(match.index))?.[1] ?? "";
      for (const index of indices.split(",")) {
        const file = files[Number(index)];
        if (
          index.trim() !== "" &&
          file?.endsWith(".css") &&
          !html.includes(`href="/gmt/${file}"`)
        ) {
          result.unlinked.push(file);
        }
      }
    }
  };
  for (const entry of entries) visit(entry);
  return result;
}

/** The page's own scripts (`/gmt/_astro/<name>.js`), by name. */
const pageScripts = (html: string): string[] =>
  [...html.matchAll(/<script[^>]*\ssrc="\/gmt\/_astro\/([^"]+\.js)"/g)].map(
    (m) => m[1] as string,
  );

const readChunk = (name: string): string | undefined => {
  try {
    return readFileSync(path.join(site, "_astro", name), "utf8");
  } catch {
    return undefined;
  }
};

describe("toolImportPreload", () => {
  const html = '<link href="/gmt/_astro/ok.AAA.css">';
  const tool = "const t=o({page:`demo`,name:`x`});";
  const table = (files: string[]) =>
    `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=${JSON.stringify(files)})))=>i;`;
  const chunks: Record<string, string> = {
    "tool.js": tool,
    "mount.js": "export const m=1;",
    "hop.js": `${table(["_astro/tool.js", "_astro/ok.AAA.css", "_astro/bad.BBB.css"])}export const l=()=>e(()=>import(\`./tool.js\`),__vite__mapDeps([0,1,2]));`,
    "direct.js": `${table(["_astro/tool.js", "_astro/bad.BBB.css"])}e(()=>import(\`./tool.js\`),__vite__mapDeps([0,1]));`,
    "both.js": `${table(["_astro/tool.js", "_astro/ok.AAA.css", "_astro/mount.js", "_astro/bad.BBB.css"])}e(()=>import(\`./mount.js\`),__vite__mapDeps([2,3]));e(()=>import(\`./tool.js\`),__vite__mapDeps([0,1]));`,
    "via-hop.js": `${table(["_astro/hop.js"])}import(\`./hop.js\`).then(h=>h.l()),__vite__mapDeps([0])`,
  };
  const read = (name: string) => chunks[name];

  it("flags a sheet in the tool import's own list", () => {
    expect(toolImportPreload(html, "demo", ["direct.js"], read)).toEqual({
      found: 1,
      unlinked: ["_astro/bad.BBB.css"],
    });
  });

  it("leaves a sheet in the mount import's list alone", () => {
    expect(toolImportPreload(html, "demo", ["both.js"], read)).toEqual({
      found: 1,
      unlinked: [],
    });
  });

  it("follows a tool reached through a hop and flags its sheet", () => {
    expect(toolImportPreload(html, "demo", ["via-hop.js"], read)).toEqual({
      found: 1,
      unlinked: ["_astro/bad.BBB.css"],
    });
  });

  it("finds nothing, rather than passing, when no import reaches the tool", () => {
    expect(toolImportPreload(html, "other", ["via-hop.js"], read).found).toBe(
      0,
    );
  });
});

describe("the built WebMCP markers", () => {
  const toolsDir = path.join(site, "tools");
  const pages = readdirSync(path.join(SRC, "content/docs/tools"))
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.slice(0, -".mdx".length))
    .filter((slug) => slug !== "index");

  it("has a tool folder for every .mdx page", () => {
    if (dist === null) return;
    const folders = readdirSync(toolsDir).filter((name) =>
      statSync(path.join(toolsDir, name)).isDirectory(),
    );
    expect(folders.filter((name) => name !== "index").sort()).toEqual(
      [...pages].sort(),
    );
  });

  it("puts exactly one marker, naming the slug, on each tool page", () => {
    if (dist === null) return;
    const wrong = pages.flatMap((slug) => {
      const found = markersIn(path.join(toolsDir, slug, "index.html"));
      return found.length === 1 && found[0] === slug
        ? []
        : [`${slug}: ${found.join(",") || "none"}`];
    });
    expect(wrong).toEqual([]);
  });

  it("puts a marker on no other page", () => {
    if (dist === null) return;
    const toolPages = new Set(
      pages.map((slug) => path.join(toolsDir, slug, "index.html")),
    );
    const stray = htmlFiles(site).filter(
      (file) => !toolPages.has(file) && markersIn(file).length > 0,
    );
    expect(stray.map((file) => path.relative(site, file))).toEqual([]);
  });

  it("links every stylesheet a tool page's tool import would preload", () => {
    if (dist === null) return;
    // Only the pages that offer a tool: the ones with a module under `tools/`.
    const offering = readdirSync(path.join(SRC, "lib/webmcp/tools"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.slice(0, -".ts".length));
    expect(offering.length).toBeGreaterThan(0);
    const missing: string[] = [];
    const stranded: string[] = [];
    for (const slug of offering) {
      const html = readFileSync(
        path.join(toolsDir, slug, "index.html"),
        "utf8",
      );
      const { found, unlinked } = toolImportPreload(
        html,
        slug,
        pageScripts(html),
        readChunk,
      );
      if (found === 0) missing.push(slug);
      stranded.push(...unlinked.map((file) => `${slug}: ${file}`));
    }
    expect(missing).toEqual([]);
    expect(stranded).toEqual([]);
  });
});
