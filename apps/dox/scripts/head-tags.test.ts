import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { SITE_URL } from "../src/lib/site";
import { TITLE_SUFFIX } from "../src/lib/head-tags";
import {
  editPath,
  scanHead,
  type HeadScan,
} from "./build-utils/head-tags-scan";
import { distDirOrSkip as distRootOrSkip } from "./dist-dir";

/**
 * The tags every built page carries, read off `dist/gmt`: one title that ends in the site suffix,
 * a description of its own, a share image that exists, the JSON-LD blocks, the Markdown twin, an
 * edit link that reaches a tracked file, and no `noindex` page in the sitemap.
 *
 * Needs a build; each test returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

/** The built pages: `dist/gmt`, or null without a build. */
function distDirOrSkip(): string | null {
  const root = distRootOrSkip();
  return root === null ? null : resolve(root, "gmt");
}

type Page = {
  /** `index.html` or `guides/index.html`, relative to `dist/gmt`. */
  file: string;
  /** The route without a trailing slash: `""` for the home page. */
  route: string;
  html: string;
  scan: HeadScan;
};

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

let cache: { dist: string; pages: Page[] } | undefined;

/** Every built page except the 404 page and a redirect stub. */
function builtPages(dist: string): Page[] {
  if (cache?.dist === dist) return cache.pages;
  const pages = htmlFiles(dist)
    .map((path) => relative(dist, path).split("\\").join("/"))
    .filter((file) => file !== "404.html")
    .flatMap((file) => {
      const html = readFileSync(resolve(dist, file), "utf8");
      if (/http-equiv=["']refresh["']/i.test(html)) return [];
      const route = file.replace(/(?:^|\/)index\.html$/, "");
      return [{ file, route, html, scan: scanHead(html) }];
    });
  cache = { dist, pages };
  return pages;
}

const isHome = (page: Page): boolean => page.route === "";

/** The pages built from the docs collection; `/dox/` is an Astro page of its own. */
const isDocsPage = (page: Page): boolean => page.route !== "dox";

/** Tracked files. A source with no commit yet (a new page) is absent, and has no date to check. */
const tracked = new Set(
  execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean),
);

/** The description `astro.config.mjs` gives the site, which a page must not repeat as its own. */
function siteDescription(): string {
  const config = readFileSync(
    resolve(import.meta.dirname, "..", "astro.config.mjs"),
    "utf8",
  );
  const found = /starlight\(\{[\s\S]*?description:\s*"([^"]+)"/.exec(
    config,
  )?.[1];
  if (!found) throw new Error("astro.config.mjs has no site description");
  return found;
}

/** At most 15 failures, then the total. */
function report(failures: string[]): string {
  const shown = failures.slice(0, 15).join("\n  ");
  const more =
    failures.length > 15 ? `\n  ... and ${failures.length - 15} more` : "";
  return `${failures.length} failure(s):\n  ${shown}${more}`;
}

function expectNone(failures: string[]): void {
  expect(failures, report(failures)).toEqual([]);
}

/** The JSON-LD objects of a page; a block that does not parse is a failure of its own. */
function jsonLdOf(page: Page): Array<Record<string, unknown>> {
  return page.scan.jsonLd.map(
    (text) => JSON.parse(text) as Record<string, unknown>,
  );
}

/** The dist file a site URL names, or undefined for a URL outside the site. */
function distFileOf(dist: string, url: string): string | undefined {
  if (!url.startsWith(`${SITE_URL}/`)) return undefined;
  return resolve(dist, url.slice(SITE_URL.length + 1));
}

describe("head tags of the built site", () => {
  it("gives every page one title that ends in the site suffix, and the home page its own", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    const seen = new Map<string, string>();
    for (const page of builtPages(dist)) {
      const { titles } = page.scan;
      if (titles.length !== 1 || titles[0] === "") {
        failures.push(`${page.file}: ${titles.length} <title> element(s)`);
        continue;
      }
      const title = titles[0];
      if (!isHome(page) && !title.endsWith(TITLE_SUFFIX)) {
        failures.push(
          `${page.file}: "${title}" does not end in "${TITLE_SUFFIX}"`,
        );
      }
      if (isHome(page) && title.endsWith(TITLE_SUFFIX)) {
        failures.push(
          `${page.file}: the home title "${title}" carries the suffix`,
        );
      }
      const other = seen.get(title);
      if (other !== undefined)
        failures.push(`${page.file}: "${title}" repeats ${other}`);
      seen.set(title, page.file);
    }
    expectNone(failures);
  });

  it("gives every page a description of its own, and only the home page the site's", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const site = siteDescription();
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      const { description } = page.scan;
      if (!description) failures.push(`${page.file}: no description`);
      else if (description === site && !isHome(page)) {
        failures.push(`${page.file}: the description is the site's`);
      }
    }
    expectNone(failures);
  });

  it("points every page's share images at a file under /gmt/og/", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      for (const [tag, url] of [
        ["og:image", page.scan.ogImage],
        ["twitter:image", page.scan.twitterImage],
      ] as const) {
        if (!url?.startsWith(`${SITE_URL}/og/`) || !url.endsWith(".png")) {
          failures.push(`${page.file}: ${tag} is ${url ?? "missing"}`);
          continue;
        }
        const file = distFileOf(dist, url);
        if (file === undefined || !existsSync(file)) {
          failures.push(`${page.file}: ${tag} ${url} is not in dist`);
        }
      }
    }
    expectNone(failures);
  });

  it("writes JSON-LD that parses, with the package on the home page", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const gmt = JSON.parse(
      readFileSync(
        resolve(repoRoot, "packages", "gmt", "package.json"),
        "utf8",
      ),
    ) as { version: string };
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      try {
        jsonLdOf(page);
      } catch (error) {
        failures.push(
          `${page.file}: JSON-LD does not parse (${(error as Error).message})`,
        );
      }
    }
    expectNone(failures);

    const home = builtPages(dist).find(isHome);
    expect(home, "the home page is built").toBeDefined();
    const code = jsonLdOf(home!).find(
      (item) => item["@type"] === "SoftwareSourceCode",
    );
    expect(code, "the home page has a SoftwareSourceCode block").toBeDefined();
    expect(code!.version).toBe(gmt.version);
  });

  it("gives every docs page a breadcrumb trail", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      if (!isDocsPage(page) || isHome(page)) continue;
      const trail = jsonLdOf(page).find(
        (item) => item["@type"] === "BreadcrumbList",
      );
      if (!trail) failures.push(`${page.file}: no BreadcrumbList`);
    }
    expectNone(failures);
  });

  it("gives every guide a TechArticle, dated when its source has a commit", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    let guides = 0;
    for (const page of builtPages(dist)) {
      if (!page.route.startsWith("guides/")) continue;
      guides += 1;
      const article = jsonLdOf(page).find(
        (item) => item["@type"] === "TechArticle",
      );
      if (!article) {
        failures.push(`${page.file}: no TechArticle`);
        continue;
      }
      const source = ["mdx", "md"]
        .flatMap((ext) => [
          `apps/dox/src/content/docs/${page.route}.${ext}`,
          `apps/dox/src/content/docs/${page.route}/index.${ext}`,
        ])
        .find((path) => tracked.has(path));
      if (source !== undefined && typeof article.dateModified !== "string") {
        failures.push(
          `${page.file}: ${source} is tracked but the article has no dateModified`,
        );
      }
    }
    expect(guides).toBeGreaterThan(0);
    expectNone(failures);
  });

  it("links every docs page to a Markdown twin that is built", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      if (!isDocsPage(page)) continue;
      const { markdownAlternates } = page.scan;
      if (markdownAlternates.length !== 1) {
        failures.push(
          `${page.file}: ${markdownAlternates.length} Markdown alternate link(s)`,
        );
        continue;
      }
      const file = distFileOf(dist, markdownAlternates[0]);
      if (file === undefined || !existsSync(file)) {
        failures.push(`${page.file}: ${markdownAlternates[0]} is not in dist`);
      }
    }
    expectNone(failures);
  });

  it("lists no page that asks not to be indexed in the sitemap", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const sitemap = readFileSync(resolve(dist, "sitemap-0.xml"), "utf8");
    const listed = new Set(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
    );
    expect(listed.size).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const page of builtPages(dist)) {
      const url = `${SITE_URL}/${page.route}${page.route ? "/" : ""}`;
      if (page.scan.noindex && listed.has(url)) {
        failures.push(`${page.file}: noindex, and ${url} is in the sitemap`);
      }
    }
    expectNone(failures);
  });

  it("points every edit link at a file that exists in the repository and is not ignored", () => {
    const dist = distDirOrSkip();
    if (dist === null) return;
    const targets = new Map<string, string>();
    let links = 0;
    for (const page of builtPages(dist)) {
      for (const href of page.scan.editLinks) {
        links += 1;
        targets.set(editPath(href), page.file);
      }
    }
    expect(links).toBeGreaterThan(0);
    const failures: string[] = [];
    const present = [...targets.keys()].filter((path) => {
      const found = existsSync(resolve(repoRoot, path));
      if (!found) failures.push(`${targets.get(path)}: ${path} does not exist`);
      return found;
    });
    // One batched call; `git check-ignore` prints each path that an ignore rule matches.
    const ignored = new Set(
      spawnSync("git", ["check-ignore", "--stdin"], {
        cwd: repoRoot,
        input: present.join("\n"),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
        .stdout.split("\n")
        .filter(Boolean),
    );
    for (const path of present) {
      if (ignored.has(path))
        failures.push(`${targets.get(path)}: ${path} is gitignored`);
    }
    expectNone(failures);
  });
});
