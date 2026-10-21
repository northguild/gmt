/**
 * `internal/temporal.ts` is the one module that names the Temporal implementation. The lint rule
 * catches import and export declarations; this scan also catches the forms it cannot see, such as
 * an `import("…")` type expression or a `require` call.
 */
import { sourceTree } from "../test/sourceTree";

const SEAM = "src/internal/temporal.ts";
const SPECIFIER = /["'`]@js-temporal\/polyfill["'`]/;

describe("the Temporal seam", () => {
  // Scans every file in src and bench: about 0.5 s alone, far slower under the full suite's load.
  it("is the only file in src or bench that names the polyfill as a module", () => {
    const offenders = [...sourceTree("src"), ...sourceTree("bench")]
      .filter(([file, text]) => {
        if (file === SEAM) return false;
        // Most files never mention the polyfill; only those that do are read line by line.
        return (
          SPECIFIER.test(text) &&
          text
            .split("\n")
            .some(
              (line) =>
                SPECIFIER.test(line) &&
                !/^\s*(?:\*|\/\/)(?!.*@import)/.test(line),
            )
        );
      })
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  }, 30_000);

  it("names the polyfill itself", () => {
    expect(sourceTree("src").get(SEAM)).toMatch(SPECIFIER);
  });
});
