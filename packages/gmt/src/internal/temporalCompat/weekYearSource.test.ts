import { sourceTree } from "../../test/sourceTree";

/*
 * CORE-112 (D23): the rule that keeps the V8 abort out of every library path. A formatter built
 * anywhere but the guarded places could reach `formatToParts` or `formatRangeToParts` on a `Y`
 * pattern, and V8 without commit 0426b0d1045d aborts the whole process there (nodejs/node#67076,
 * uncatchable). So library code builds a date formatter only through `cachedFormatter` (the guard's
 * hook), and the engine's range parts are called only where no week-year can be: the D17 branch of
 * `formatZonedRange` (SpiderMonkey only) and the probes. Comments are skipped.
 */
const files = [...sourceTree("src")].filter(
  ([name]) => !name.endsWith(".test.ts") && !name.startsWith("src/test/"),
);

/** The text without block comments and line comments, keeping line numbers. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** `file:line` of every match of `pattern` in the files, outside `allowed`. */
function found(pattern: RegExp, allowed: readonly string[]): string[] {
  return files.flatMap(([name, text]) =>
    allowed.includes(name)
      ? []
      : code(text)
          .split("\n")
          .flatMap((line, index) =>
            pattern.test(line) ? [`${name}:${index + 1}`] : [],
          ),
  );
}

describe("week-year source rule", () => {
  it("constructs a date formatter only in the cache, the guard, the range helpers and the probes (the D25 to D30 probes included)", () => {
    expect(
      found(/new Intl\.DateTimeFormat\(/, [
        "src/internal/formatterCache.ts",
        "src/internal/weekYearGuard.ts",
        "src/internal/weekYearRange.ts",
        "src/internal/rangeFallback.ts",
        "src/internal/rangeFields.ts",
        "src/internal/rangeFieldValues.ts",
        "src/internal/temporalCompat/rangeFieldRepros.ts",
        "src/internal/weekYearSynth.ts",
        "src/internal/weekYearText.ts",
        "src/internal/resolveLocale.ts",
        "src/internal/temporalCompat/capabilities.ts",
        "src/internal/temporalCompat/probeRepros.ts",
        "src/internal/temporalCompat/repros.ts",
        // The engine's own formatter for the range parts of a stand-in carrier (D17 branch only).
        "src/zoned/format/formatZonedRange.ts",
      ]),
    ).toEqual([]);
  });

  it("calls formatRangeToParts only in the probes and the zoned range D17 branch", () => {
    expect(
      found(/formatRangeToParts\(/, [
        "src/internal/temporalCompat/probeRepros.ts",
        "src/internal/weekYearGuard.ts",
        "src/internal/japaneseNumerals.ts",
        "src/internal/yearPrinting.ts",
        "src/zoned/format/formatZonedRange.ts",
      ]),
    ).toEqual([]);
    const range = files.find(
      ([name]) => name === "src/zoned/format/formatZonedRange.ts",
    );
    // The carrier's call, and the engine's own formatter when the carrier is a stand-in.
    expect(code(range?.[1] ?? "").match(/formatRangeToParts\(/g)).toHaveLength(
      2,
    );
  });

  it("calls a formatter's formatRange only in the range check, the D29 range helpers and the era-year numerals wrapper under the guard, so every range gets the year repair", () => {
    expect(
      found(/\.formatRange\(/, [
        "src/internal/weekYearRange.ts",
        "src/internal/rangeFallback.ts",
        "src/internal/rangeFields.ts",
        "src/internal/rangeDetector.ts",
        "src/internal/temporalCompat/rangeFieldRepros.ts",
        "src/internal/japaneseNumerals.ts",
        // The two stand-ins call the engine's own range only while no range repair is installed.
        "src/internal/weekYearGuard.ts",
        "src/internal/yearPrinting.ts",
      ]),
    ).toEqual([]);
  });

  it.each`
    module             | importers
    ${"weekYearGuard"} | ${["src/internal/formatterCache.ts"]}
    ${"weekYearSynth"} | ${["src/internal/weekYearGuard.ts"]}
    ${"yearPrinting"}  | ${["src/internal/formatterCache.ts", "src/internal/japaneseNumerals.ts"]}
    ${"weekYearRange"} | ${["src/internal/rangeRepairs.ts", "src/internal/yearPrintingRange.ts"]}
  `(
    "imports $module only from $importers",
    ({ module, importers }: { module: string; importers: string[] }) => {
      expect(found(new RegExp(`from "[./]*/${module}"`), importers)).toEqual(
        [],
      );
    },
  );
});
