import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/*
 * CORE-112: the package declares `sideEffects: false`, so a bundler may drop any module-level
 * call whose result nothing reads. The range repairs must therefore be installed by an explicit
 * call from each range entry point. This file bundles the three range functions with rolldown
 * (the bundler behind tsdown and Vite 8) and runs the output.
 */

const here = import.meta.dirname;
const src = path.resolve(here, "..");

/**
 * Rolldown's build, run in a child process: it is not a direct dependency (it is resolved the way
 * `tsdown` resolves it) and it installs process-wide handlers a shared worker must not keep.
 */
const buildScript = `
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const [entry, cwd, out] = process.argv.slice(1);
const fromTsdown = createRequire(createRequire(cwd + "/package.json").resolve("tsdown/package.json"));
const { rolldown } = await import(pathToFileURL(fromTsdown.resolve("rolldown")).href);
const built = await rolldown({ input: entry, cwd, logLevel: "silent", platform: "node" });
await built.write({ file: out, format: "esm" });
`;

/** The three range functions, each bundled alone so that a missing install in one of them fails it. */
const entries = {
  formatDateRange: "plain/format/formatDateRange.ts",
  formatDateTimeRange: "plain/format/formatDateTimeRange.ts",
  formatZonedRange: "zoned/format/formatZonedRange.ts",
} as const;

type RangeFunction = (...args: unknown[]) => string;

/**
 * The bundles import `@js-temporal/polyfill`, which stores two slot functions on `globalThis` when
 * it loads. A run on a native engine loads no polyfill before this file, so the keys are new here
 * and must go once the file is done. The loaded copy keeps its own references to both functions.
 */
const polyfillSlots = [
  Symbol.for("@@Temporal__GetSlots"),
  Symbol.for("@@Temporal__CreateSlots"),
];

describe("range repairs survive a tree-shaking bundler", () => {
  let dir = "";
  const bundles: Partial<Record<keyof typeof entries, RangeFunction>> = {};
  const slotsAdded: symbol[] = [];

  beforeAll(async () => {
    slotsAdded.push(...polyfillSlots.filter((key) => !(key in globalThis)));
    dir = mkdtempSync(path.join(tmpdir(), "gmt-range-bundle-"));
    const pkg = path.resolve(here, "../..");
    for (const [name, file] of Object.entries(entries)) {
      const entry = path.join(dir, `${name}.ts`);
      writeFileSync(entry, `export { ${name} } from "${src}/${file}";`);
      // The output sits in the package so its `@js-temporal/polyfill` import resolves.
      const out = path.join(pkg, `.range-bundle-${name}-${process.pid}.mjs`);
      try {
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", buildScript, entry, pkg, out],
          { stdio: "pipe" },
        );
        const built = (await import(pathToFileURL(out).href)) as Record<
          string,
          RangeFunction
        >;
        bundles[name as keyof typeof entries] = built[name];
      } finally {
        rmSync(out, { force: true });
      }
    }
  }, 120_000);

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const key of slotsAdded) Reflect.deleteProperty(globalThis, key);
  });

  it("formatDateRange prints each end of a japanese-calendar range before 1873 in its Gregorian twin", () => {
    const text = bundles.formatDateRange!(
      "1700-07-10",
      "1700-07-12",
      "en-u-ca-japanese",
      { era: "short", year: "numeric", month: "short", day: "numeric" },
    );
    expect(text).toBe("Jul 10 - 12, 1700 AD");
  });

  it("formatDateTimeRange takes the same repair", () => {
    const text = bundles.formatDateTimeRange!(
      "1700-07-10T09:00",
      "1700-07-12T09:00",
      "en-u-ca-japanese",
      {
        era: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
      },
    );
    expect(text).not.toContain("Genroku");
    expect(text).toContain("AD");
  });

  it("formatZonedRange takes the same repair", () => {
    const text = bundles.formatZonedRange!(
      "1700-07-10T09:00:00[UTC]",
      "1700-07-12T09:00:00[UTC]",
      "en-u-ca-japanese",
      { era: "short", year: "numeric", month: "short", day: "numeric" },
    );
    expect(text).not.toContain("Genroku");
    expect(text).toContain("AD");
  });
});
