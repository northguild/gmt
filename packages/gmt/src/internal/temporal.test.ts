/**
 * `internal/temporal.ts` is the one module that names the Temporal implementation. The lint rule
 * catches import and export declarations; this scan also catches the forms it cannot see, such as
 * an `import("…")` type expression or a `require` call.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PACKAGE_DIR = path.resolve(import.meta.dirname, "../..");
const SEAM = path.join("src", "internal", "temporal.ts");
const SPECIFIER = /["'`]@js-temporal\/polyfill["'`]/;

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(path.join(PACKAGE_DIR, dir), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.(?:c|m)?tsx?$/.test(entry.name))
    .map((entry) =>
      path.relative(PACKAGE_DIR, path.join(entry.parentPath, entry.name)),
    );
}

describe("the Temporal seam", () => {
  // Reads every file in src and bench: about 0.5 s alone, far slower under the full suite's load.
  it("is the only file in src or bench that names the polyfill as a module", () => {
    const offenders = [...sourceFiles("src"), ...sourceFiles("bench")].filter(
      (file) => {
        if (file === SEAM) return false;
        const text = readFileSync(path.join(PACKAGE_DIR, file), "utf8");
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
      },
    );

    expect(offenders).toEqual([]);
  }, 30_000);

  it("names the polyfill itself", () => {
    expect(readFileSync(path.join(PACKAGE_DIR, SEAM), "utf8")).toMatch(
      SPECIFIER,
    );
  });
});
