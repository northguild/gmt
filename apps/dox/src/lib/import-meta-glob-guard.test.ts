/**
 * Guard: no module tests whether `import.meta.glob` exists.
 *
 * Vite rewrites each `import.meta.glob(…)` call at build, but leaves a test of the function
 * itself, such as `typeof import.meta.glob === "function"`, in the built code, where it is false.
 * A module guarded that way reads its optional file in dev and never in the built site: `/pulse/`
 * said "Run history was not read in this build" on every deploy, though the file was there.
 *
 * A module that also runs in plain Node tests `import.meta.env` instead, which Vite replaces at
 * build and plain Node leaves `undefined`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..");

/** `typeof import.meta.glob`, or `import.meta.glob` tested as a value rather than called. */
const PROBE =
  /typeof\s+import\.meta\.glob\b|!\s*import\.meta\.glob\b|import\.meta\.glob\s*(?:[!=]==?|\?|&&|\|\|)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(?:[cm]?[jt]sx?|astro)$/.test(name) && !name.includes(".test.")
      ? [full]
      : [];
  });
}

describe("import.meta.glob is never tested for existence", () => {
  it("finds the probe it bans", () => {
    expect(PROBE.test(`typeof import.meta.glob === "function"`)).toBe(true);
    expect(PROBE.test(`import.meta.glob ? a : b`)).toBe(true);
    expect(PROBE.test(`import.meta.glob("./x.json", { eager: true })`)).toBe(
      false,
    );
  });

  it("has no module that tests it", () => {
    const report = walk(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          PROBE.test(line) && !line.trimStart().startsWith("//")
            ? [`${path.relative(SRC, file)}:${i + 1}`]
            : [],
        ),
    );
    expect(report).toEqual([]);
  });
});
