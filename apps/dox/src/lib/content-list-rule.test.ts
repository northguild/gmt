/**
 * The prose list marker never reaches a widget.
 *
 * `gmt-content.css` draws a dash before every list item on a content page. A
 * list inside a `.gmt-widget` is a legend, a row of verdicts or a key, so its
 * three rules (the `ul`, its `li` and the `li::before`) skip any list that sits
 * inside a widget. The browser pass checks the same thing on the built pages.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(
  path.resolve(import.meta.dirname, "..", "styles", "gmt-content.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const EXCLUSION = ":not(:where(.gmt-widget *))";

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

  it("excludes a list inside a widget in every rule that styles a bullet", () => {
    expect(selectors.length).toBeGreaterThanOrEqual(3);
    for (const selector of selectors) {
      expect(selector, selector).toContain(EXCLUSION);
    }
  });
});
