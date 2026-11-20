/**
 * Every link on the site is written by one of its link homes, so an external link opens in a new
 * tab everywhere (`external-link.ts`). A component writes `<Link>` (`Link.astro`, or
 * `ask/Link.tsx` in the chat), a widget builder or mount calls `link()`
 * (`widgets/builders/link.ts`), and Markdown goes through `rehype-external-links.ts`. A bare `<a>`
 * anywhere else is how `ICU-23627` on /day-off came to open in the same tab.
 *
 * Comments are skipped: explaining a link names `<a>`. Vendored `ui/` is skipped, as in
 * `date-ban.test.ts`. Content `.mdx` is skipped: the rehype plugin covers its links, and its own
 * `<a id>` tags are anchors to land on, not links.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// .../apps/dox/src/lib/link-homes.test.ts -> apps/dox.
const DOX = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const SRC = join(DOX, "src");

const ANCHOR = /<a[\s>]|<a$|createElement\(\s*["']a["']\s*\)/;
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".astro"]);
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "ui",
  "generated",
  "content",
]);

/** The homes, each reading `linkTarget`, plus Starlight overrides that keep Starlight's markup. */
const HOMES = new Set([
  "src/components/Link.astro",
  "src/components/ask/Link.tsx",
  "src/widgets/builders/link.ts",
  "src/components/ButtonLink.astro",
  "src/components/SidebarSublist.astro",
]);

/**
 * Links that can only ever point at this page, so where they open is never in question: the
 * header's site title, and the reload link a widget that failed to load offers (`href=""`).
 */
const SAME_PAGE = new Set([
  "src/components/SiteTitle.astro",
  "src/lib/widget-mount.ts",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIPPED_DIRECTORIES.has(name)) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    if (!SCANNED_EXTENSIONS.has(extname(name))) return [];
    if (/\.test\.tsx?$/.test(name) || name.endsWith(".d.ts")) return [];
    return [full];
  });
}

/** The source with its comments gone: block, JSX, HTML and line comments. */
const code = (text: string): string =>
  text
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const FILES = walk(SRC)
  .map((full) => relative(DOX, full))
  .sort();

describe("link homes", () => {
  it("scans the components, the widgets and the mounts", () => {
    expect(FILES).toContain("src/components/Header.astro");
    expect(FILES).toContain("src/components/ask/ChatInfo.tsx");
    expect(FILES).toContain("src/widgets/builders/data-credits.ts");
    expect(FILES).toContain("src/lib/cron-in-a-zone-mount.ts");
  });

  it("writes an <a> only in a link home", () => {
    const outside = FILES.filter(
      (rel) => !HOMES.has(rel) && !SAME_PAGE.has(rel),
    ).filter((rel) => ANCHOR.test(code(readFileSync(join(DOX, rel), "utf8"))));
    expect(outside).toEqual([]);
  });

  it("has every home read linkTarget", () => {
    const blind = [...HOMES].filter(
      (rel) => !readFileSync(join(DOX, rel), "utf8").includes("linkTarget"),
    );
    expect(blind).toEqual([]);
  });
});
