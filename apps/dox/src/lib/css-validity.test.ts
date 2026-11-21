/**
 * Static checks for CSS mistakes the browser drops without a word.
 *
 * A declaration the parser rejects is simply ignored, so a typo ships as a
 * missing style: `bottom: -var(--x)` is not "minus x", it is invalid, and the
 * rule falls back to whatever came before it. `calc(-1 * var(--x))` is the
 * spelling that negates a custom property.
 *
 * A custom property that reads itself, `--x: var(--x)`, is a cycle: CSS
 * Custom Properties Level 1 §2.3 makes it invalid at computed-value time, so
 * every `var(--x)` falls back as if unset. A search-and-replace that turns a
 * value into its own token writes exactly that.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..");

/** Every stylesheet under `src/`, the site's own and each deck's. */
const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".css"))
  .sort();

function declarations(file: string): { line: string; n: number }[] {
  return readFileSync(path.join(SRC, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }));
}

describe("stylesheets", () => {
  it("scans the sheets", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(path.join("components", "slides", "slides.css"));
  });

  it.each(files)("%s negates no custom property with a bare minus", (file) => {
    const offenders = declarations(file).filter(({ line }) =>
      /[:\s(,]-var\(/.test(line),
    );
    expect(offenders).toEqual([]);
  });

  it.each(files)("%s defines no custom property by itself", (file) => {
    const offenders = declarations(file).filter(({ line }) =>
      /(--[\w-]+)\s*:[^;]*var\(\s*\1\s*[,)]/.test(line),
    );
    expect(offenders).toEqual([]);
  });

  it("catches a custom property defined by itself", () => {
    const self = /(--[\w-]+)\s*:[^;]*var\(\s*\1\s*[,)]/;
    expect(self.test("  --text-sm: var(--text-sm);")).toBe(true);
    expect(self.test("  --a: var(--a, 1rem);")).toBe(true);
    expect(self.test("  --bar: var(--bar-size);")).toBe(false);
  });
});
