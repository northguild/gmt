/// <reference types="vitest/globals" />

/**
 * Static checks for CSS mistakes the browser drops without a word.
 *
 * A declaration the parser rejects is simply ignored, so a typo ships as a
 * missing style: `bottom: -var(--x)` is not "minus x", it is invalid, and the
 * rule falls back to whatever came before it. `calc(-1 * var(--x))` is the
 * spelling that negates a custom property.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const STYLES = path.resolve(import.meta.dirname, "..", "styles");

describe("stylesheets", () => {
  const files = readdirSync(STYLES).filter((f) => f.endsWith(".css"));

  it("scans the sheets", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s negates no custom property with a bare minus", (file) => {
    const css = readFileSync(path.join(STYLES, file), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const offenders = css
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /[:\s(,]-var\(/.test(line));
    expect(offenders).toEqual([]);
  });
});
