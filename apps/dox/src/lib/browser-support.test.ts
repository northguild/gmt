import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NATIVE_LEGS } from "../../../../scripts/lib/canary-issues.mjs";
import { START_HERE } from "./section-order";

/**
 * The browser support page states no figure by hand and names exactly the
 * weekly legs the workflow runs.
 */

const HERE = fileURLToPath(import.meta.url);
const page = readFileSync(
  resolve(HERE, "../../content/docs/browser-support.mdx"),
  "utf8",
);
const WORKFLOW =
  "https://github.com/northguild/gmt/actions/workflows/temporal-oracle.yml";

/** The page text without its import lines and frontmatter. */
const text = page.replace(/^---[\s\S]*?---\n/, "").replace(/^import .*$/gm, "");

/** The code spans in the last column of the page's first table. */
function legColumn(): string[] {
  const rows = text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2);
  const spans: string[] = [];
  for (const row of rows) {
    const cells = row.split("|").slice(1, -1);
    const last = cells[cells.length - 1] ?? "";
    for (const m of last.matchAll(/`([^`]+)`/g)) spans.push(m[1] as string);
  }
  return spans;
}

describe("browser support page", () => {
  it("lists every native-suite leg in the table's last column, and no other leg", () => {
    const spans = new Set(legColumn());
    expect([...spans].sort()).toEqual([...NATIVE_LEGS].sort());
  });

  it("imports and uses syntaxFloor and gmtNodeEngines", () => {
    expect(page).toMatch(
      /import \{ syntaxFloor \} from "~\/generated\/syntax-floor";/,
    );
    expect(page).toMatch(
      /import \{ gmtNodeEngines \} from "~\/generated\/versions";/,
    );
    expect(text).toContain("{syntaxFloor.edition}");
    expect(text).toContain("{gmtNodeEngines}");
  });

  it.each`
    label                   | pattern
    ${"an ECMAScript year"} | ${/ES20\d\d/}
    ${"a node range"}       | ${/>=\s*\d/}
    ${"a browser version"}  | ${/\b(?:Chrome|Chromium|Firefox|Safari|WebKit|Node)(?:\.js)? \d/}
  `("has no hand-written figure: $label", ({ pattern }) => {
    expect(text).not.toMatch(pattern);
  });

  it("links the weekly workflow and no dated run", () => {
    expect(text).toContain(WORKFLOW);
    const links =
      text.match(
        /https:\/\/github\.com\/northguild\/gmt\/actions\/[^\s)>"]*/g,
      ) ?? [];
    expect(new Set(links)).toEqual(new Set([WORKFLOW]));
    expect(text).not.toContain("/actions/runs/");
  });
});

describe("START_HERE", () => {
  it("puts browser-support second", () => {
    expect(START_HERE.map((p) => p.slug)).toEqual([
      "install",
      "browser-support",
      "core-rules",
      "why-gmt",
    ]);
  });
});
