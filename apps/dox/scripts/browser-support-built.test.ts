import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { syntaxFloor } from "../src/generated/syntax-floor";
import { gmtNodeEngines } from "../src/generated/versions";
import { distDirOrSkip } from "./dist-dir";

/**
 * On the built site: the figures the Browser support page states reach its HTML
 * as values. MDX does not evaluate an expression inside a backtick span, so a figure written as
 * `{gmtNodeEngines}` in code ticks ships its braces. Needs a build; returns early without one and
 * throws under `DOX_DIST_REQUIRED`.
 */

/** Every built `.html` page under `dist/gmt`. */
function builtHtml(root: string): string[] {
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(root, f));
}

/** Text of the page's `<main>`, tags removed. */
function mainText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  return main
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x3E;|&gt;/g, ">")
    .replace(/&#x3C;|&lt;/g, "<")
    .replace(/\s+/g, " ");
}

describe("browser support page, built", () => {
  const dist = distDirOrSkip();

  it("shows the generated Node range and syntax figures, and no literal expression", () => {
    if (dist === null) return;
    const html = readFileSync(
      resolve(dist, "gmt", "browser-support", "index.html"),
      "utf8",
    );
    const text = mainText(html);
    expect(text).toMatch(
      new RegExp(
        `says ${gmtNodeEngines.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\.`,
      ),
    );
    expect(text).toContain(`edition ${syntaxFloor.edition} (ES modules)`);
    expect(text).toContain(`all ${syntaxFloor.entries} entry points`);
    expect(text).not.toMatch(/\{[A-Za-z_][\w.]*\}/);
  });

  it("no built page shows a bare expression in a code span, such as <code>{gmtNodeEngines}</code>", () => {
    if (dist === null) return;
    const hits = builtHtml(resolve(dist, "gmt")).filter((file) =>
      /<code[^>]*>\{[A-Za-z_][\w.]*\}<\/code>/.test(readFileSync(file, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
