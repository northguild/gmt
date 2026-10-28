import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import {
  badJsLiterals,
  baseHelperNames,
  badLinksInMarkdown,
  badRedirectRules,
  badSitemapLocs,
  badUrlsInCss,
  badUrlsInHtml,
  type BaseFailure,
} from "./build-utils/dist-base";
import { distDirOrSkip } from "./dist-dir";
import { referenceRoutes } from "../src/generated/reference/route-manifest";

/**
 * The /gmt base, read off the built site (CORE-86).
 *
 * Dox serves under `northguild.dev/gmt`; its routes are base-less in code and `/gmt` is added where
 * a URL leaves it. One bug class — a root-absolute URL that reaches a reader without the base — can
 * come in through HTML, CSS, JS, the `.md` twins, `llms*.txt`, the sitemap and `_redirects`. This
 * reads each of them. A root URL without `/gmt` anywhere in `dist/` fails here.
 *
 * Needs a build; each test returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

/** Every file under `dir` whose name satisfies `keep`, as absolute paths. */
function walk(dir: string, keep: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, keep));
    else if (keep(entry.name)) found.push(full);
  }
  return found;
}

/** At most 20 failures with file and value, then the total. */
function report(
  root: string,
  failures: Array<BaseFailure & { file: string }>,
): string[] {
  const lines = failures
    .slice(0, 20)
    .map((f) => `${relative(root, f.file)}: ${f.value} — ${f.where}`);
  if (failures.length > 20)
    lines.push(`… ${failures.length} failures in total`);
  return lines;
}

function scan(
  root: string,
  files: string[],
  scanner: (text: string) => BaseFailure[],
): string[] {
  const failures: Array<BaseFailure & { file: string }> = [];
  for (const file of files)
    for (const f of scanner(readFileSync(file, "utf8")))
      failures.push({ ...f, file });
  return report(root, failures);
}

/** The built `dist` and its `gmt` pages, or null without a build (throws under `DOX_DIST_REQUIRED`). */
function built(): { root: string; pages: string } | null {
  const root = distDirOrSkip();
  return root === null ? null : { root, pages: resolve(root, "gmt") };
}

describe("the built site keeps the /gmt base", () => {
  it("dist holds exactly gmt/ and _redirects", () => {
    const b = built();
    if (b === null) return;
    const { root, pages } = b;
    expect(readdirSync(root).sort()).toEqual(["_redirects", "gmt"]);
    expect(existsSync(resolve(pages, "index.html"))).toBe(true);
    expect(existsSync(resolve(pages, "404.html"))).toBe(true);
    expect(existsSync(resolve(root, "_redirects"))).toBe(true);
    expect(existsSync(resolve(pages, "_redirects"))).toBe(false);
  });

  it("no HTML page carries a URL without the base", () => {
    const b = built();
    if (b === null) return;
    const { pages } = b;
    const html = walk(pages, (n) => n.endsWith(".html"));
    expect(html.length).toBeGreaterThan(100);
    expect(scan(pages, html, badUrlsInHtml)).toEqual([]);
  });

  it("no stylesheet carries a URL without the base, and the Michroma font resolves under it", () => {
    const b = built();
    if (b === null) return;
    const { root, pages } = b;
    const astro = resolve(pages, "_astro");
    const css = readdirSync(astro)
      .filter((n) => n.endsWith(".css"))
      .map((n) => resolve(astro, n));
    expect(css.length).toBeGreaterThan(0);
    expect(scan(pages, css, badUrlsInCss)).toEqual([]);

    const sheets = css.map((f) => readFileSync(f, "utf8")).join("\n");
    const face = sheets.match(
      /@font-face\{[^}]*font-family:\s*["']?Michroma[^}]*\}/i,
    );
    expect(
      face,
      "the Michroma @font-face is in a built stylesheet",
    ).not.toBeNull();
    const src = face?.[0].match(/url\(\s*["']?([^)"']+)/i)?.[1];
    expect(src, "the Michroma @font-face has a url()").toBeDefined();
    expect(src?.startsWith("/gmt/")).toBe(true);
    // And the file it names is really there.
    expect(existsSync(resolve(root, (src as string).replace(/^\//, "")))).toBe(
      true,
    );
  });

  it("no .md twin, llms.txt or llms-full.txt carries a link without the base", () => {
    const b = built();
    if (b === null) return;
    const { pages } = b;
    const text = [
      ...walk(pages, (n) => n.endsWith(".md")),
      resolve(pages, "llms.txt"),
      resolve(pages, "llms-full.txt"),
    ];
    expect(scan(pages, text, badLinksInMarkdown)).toEqual([]);
  });

  it("every page carries one same-tab NorthGuild link with the inlined mark", () => {
    const b = built();
    if (b === null) return;
    const { pages } = b;
    const failures: Array<BaseFailure & { file: string }> = [];
    for (const file of walk(pages, (n) => n.endsWith(".html"))) {
      const html = readFileSync(file, "utf8");
      if (/http-equiv=["']refresh["']/i.test(html)) continue;
      // The 404 page is exempt only when it has no header at all.
      if (basename(file) === "404.html" && !/class="header"/.test(html))
        continue;
      const anchors = [
        ...html.matchAll(
          /<a\b[^>]*\shref="https:\/\/northguild\.dev\/"[^>]*>([\s\S]*?)<\/a>/g,
        ),
      ];
      const fail = (why: string) =>
        failures.push({ file, value: "https://northguild.dev/", where: why });
      if (anchors.length !== 1) {
        fail(`${anchors.length} NorthGuild anchors, expected 1`);
        continue;
      }
      const [tag, inner] = [anchors[0][0], anchors[0][1]];
      const open = tag.slice(0, tag.indexOf(">") + 1);
      if (/\starget=/.test(open)) fail("opens in a new tab");
      if (!/<span class="sr-only">NorthGuild home<\/span>/.test(inner))
        fail("no sr-only NorthGuild home name");
      const svg = /<svg\b[^>]*aria-hidden="true"[^>]*>([\s\S]*?)<\/svg>/.exec(
        inner,
      );
      if (svg === null) fail("no aria-hidden svg");
      else if ((svg[1].match(/<path\b/g) ?? []).length !== 5)
        fail("the mark does not have five paths");
    }
    expect(report(pages, failures)).toEqual([]);
  });

  it("_redirects has rules and every one sits under /gmt/", () => {
    const b = built();
    if (b === null) return;
    const { root } = b;
    const rules = readFileSync(resolve(root, "_redirects"), "utf8");
    expect(
      rules.split("\n").filter((l) => l.trim() && !l.startsWith("#")).length,
    ).toBeGreaterThan(0);
    expect(badRedirectRules(rules)).toEqual([]);
  });

  it("every sitemap <loc> is a northguild.dev/gmt URL", () => {
    const b = built();
    if (b === null) return;
    const { pages } = b;
    const maps = readdirSync(pages)
      .filter((n) => /^sitemap-.*\.xml$/.test(n))
      .map((n) => resolve(pages, n));
    expect(maps.length).toBeGreaterThan(0);
    expect(scan(pages, maps, badSitemapLocs)).toEqual([]);
  });

  it("no bundled script requests the site root", () => {
    const b = built();
    if (b === null) return;
    const { pages } = b;
    // The non-page top-level entries: files, and directories that hold no index.html. Derived,
    // never listed. `_astro` is Vite's own and rewrites its references itself.
    const publicNames = readdirSync(pages).filter((name) => {
      if (name === "_astro") return false;
      const full = resolve(pages, name);
      return (
        !statSync(full).isDirectory() ||
        !existsSync(resolve(full, "index.html"))
      );
    });
    expect(publicNames).toContain("pagefind");
    // The three boundary files are public assets; the Canada one is read by the clock-change map.
    expect(publicNames).toEqual(
      expect.arrayContaining([
        "timezone-boundaries.json",
        "timezone-boundaries-globe.json",
        "timezone-boundaries-canada.json",
      ]),
    );
    const js = walk(resolve(pages, "_astro"), (n) => n.endsWith(".js"));
    expect(js.length).toBeGreaterThan(0);
    const texts = Object.fromEntries(
      js.map((f) => [basename(f), readFileSync(f, "utf8")]),
    );
    const helpers = baseHelperNames(texts);
    // The helper must be found, or every call to it would read as a bare literal (or, worse, the
    // guard would have nothing to exempt and the test would pass on an empty set by luck).
    expect(Object.keys(helpers).length).toBeGreaterThan(3);
    const failures: Array<BaseFailure & { file: string }> = [];
    for (const f of js)
      for (const hit of badJsLiterals(
        texts[basename(f)],
        publicNames,
        helpers[basename(f)] ?? [],
      ))
        failures.push({ ...hit, file: f });
    expect(report(pages, failures)).toEqual([]);
  });

  it("no route begins with /gmt, so withBase leaves a /gmt/… path alone", () => {
    const routes = [...referenceRoutes].filter(
      (r) => r === "/gmt" || r.startsWith("/gmt/"),
    );
    expect(routes).toEqual([]);
    const content = walk(
      resolve(import.meta.dirname, "..", "src", "content", "docs"),
      (n) => /\.mdx?$/.test(n),
    ).map((f) =>
      relative(resolve(import.meta.dirname, "..", "src", "content", "docs"), f),
    );
    expect(
      content.filter((f) => f === "gmt.mdx" || f.startsWith("gmt/")),
    ).toEqual([]);
  });
});
