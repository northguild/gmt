/**
 * The prose list marker reaches only a list written in Markdown.
 *
 * `gmt-content.css` draws a dash before each item of a list on a content page.
 * A list a component builds carries a class (diff cards, a chart key, a row of
 * verdicts) and a widget is marked `not-content`, so the three rules (the `ul`,
 * its `li` and the `li::before`) skip both. The `frame-check` gate checks the
 * same thing on the built pages, and that each dash sits on its first line.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(
  path.resolve(import.meta.dirname, "..", "src", "styles", "gmt-content.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const EXCLUSION = ":where(:not([class], .not-content *))";

/** Every selector that styles a prose bullet: `.sl-markdown-content ul…`. */
function bulletSelectors(): string[] {
  return [...css.matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => /^\.sl-markdown-content ul(?![\w-])(?!\[)/.test(s));
}

describe("the prose bullet rule", () => {
  const selectors = bulletSelectors();

  it("has the three rules: the list, its items and the item marker", () => {
    expect(selectors).toContain(`.sl-markdown-content ul${EXCLUSION}`);
    expect(selectors).toContain(`.sl-markdown-content ul${EXCLUSION} li`);
    expect(selectors).toContain(
      `.sl-markdown-content ul${EXCLUSION} li::before`,
    );
  });

  it("excludes a classed list and a list inside a widget in every rule that styles a bullet", () => {
    expect(selectors.length).toBeGreaterThanOrEqual(3);
    for (const selector of selectors) {
      expect(selector, selector).toContain(EXCLUSION);
    }
  });
});
