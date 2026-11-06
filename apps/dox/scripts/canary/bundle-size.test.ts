import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  absentPathFailures,
  measureEntry,
  polyfillSet,
  reportShape,
} from "../../../../scripts/lib/bundle-size.mjs";

const measure = (minified: number, gzipped: number) => ({
  minified,
  gzipped,
  inputs: {},
});

describe("polyfillSet", () => {
  it("lists bytes only, so a set carries no bundler inputs", () => {
    const set = polyfillSet({
      package: "pkg-a",
      version: "1.2.3",
      importPath: "pkg-a/full",
      shipped: true,
      gmt: "9.9.9",
      from: "source",
      measured: { root: measure(10, 4) },
    });
    expect(set.entries).toEqual({ root: { minified: 10, gzipped: 4 } });
  });

  it("keeps a null entry null, for a name the release does not export", () => {
    const set = polyfillSet({
      package: "pkg-b",
      version: "0.1.0",
      importPath: "pkg-b",
      shipped: false,
      gmt: "1.0.0",
      from: "npm",
      measured: { root: measure(10, 4), gone: null },
    });
    expect(set.entries).toEqual({
      root: { minified: 10, gzipped: 4 },
      gone: null,
    });
  });

  it("names the package, version, import line, measured GMT and origin as given", () => {
    const set = polyfillSet({
      package: "pkg-c",
      version: "3.0.0",
      importPath: "pkg-c/sub",
      shipped: false,
      gmt: "4.5.6",
      from: "npm",
      measured: {},
    });
    expect(set).toMatchObject({
      package: "pkg-c",
      version: "3.0.0",
      import: "pkg-c/sub",
      shipped: false,
      gmt: "4.5.6",
      from: "npm",
    });
  });
});

describe("reportShape", () => {
  const meta = {
    measuredAt: "2026-01-02T03:04:05Z",
    node: "v0",
    esbuild: "0.0.0",
    commit: "abc",
    dirty: false,
  };
  const shipped = {
    package: "new-pkg",
    version: "1.0.0",
    importPath: "new-pkg/impl",
    gmt: "2.0.0",
    from: "source",
    measured: { root: measure(100, 40), fl: measure(30, 12) },
  };
  const previous = {
    package: "old-pkg",
    version: "0.5.0",
    importPath: "old-pkg",
    gmt: "1.0.0",
    from: "npm",
    measured: { root: measure(300, 90), fl: measure(200, 70) },
  };
  const budgets = { entries: { root: { minified: 110 } } };

  it("keeps the top-level keys and adds the budget to each shipped entry", () => {
    const report = reportShape({
      meta,
      floor: "fl",
      budgets,
      shipped,
      previous,
    });
    expect(report).toMatchObject({ ...meta, floor: "fl" });
    expect(report.entries).toEqual({
      root: { minified: 100, gzipped: 40, budget: 110 },
      fl: { minified: 30, gzipped: 12, budget: null },
    });
  });

  it("lists the shipped set first, with the same entries as the top level minus the budget", () => {
    const report = reportShape({
      meta,
      floor: "fl",
      budgets,
      shipped,
      previous,
    });
    expect(report.polyfills.map((p: { package: string }) => p.package)).toEqual(
      ["new-pkg", "old-pkg"],
    );
    expect(
      report.polyfills.map((p: { shipped: boolean }) => p.shipped),
    ).toEqual([true, false]);
    expect(report.polyfills[0].entries).toEqual({
      root: { minified: 100, gzipped: 40 },
      fl: { minified: 30, gzipped: 12 },
    });
  });

  it("lists the shipped set alone when no previous set is measured", () => {
    const report = reportShape({
      meta,
      floor: "fl",
      budgets,
      shipped,
      previous: null,
    });
    expect(report.polyfills).toHaveLength(1);
  });
});

describe("absentPathFailures", () => {
  const budgets = { absent: { entryOne: ["a/gone.ts", "a/kept.ts", "a/dir"] } };
  const kindOf = (p: string) =>
    p === "/root/pkg/a/kept.ts"
      ? "file"
      : p === "/root/pkg/a/dir"
        ? "directory"
        : "missing";

  it("says does not exist for a missing path and is not a file for a directory", () => {
    expect(absentPathFailures(budgets, "/root/pkg", kindOf)).toEqual([
      "entryOne: absent path a/gone.ts does not exist",
      "entryOne: absent path a/dir is not a file",
    ]);
  });

  it("reports nothing when every listed path is a file, or no list is given", () => {
    expect(absentPathFailures(budgets, "/root/pkg", () => "file")).toEqual([]);
    expect(absentPathFailures({}, "/root/pkg", () => "missing")).toEqual([]);
  });
});

describe("measureEntry", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bundle-size-"));
  writeFileSync(path.join(dir, "lib.ts"), "export const present = 1 + 2;\n");
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const entry = (name: string) => `export { ${name} } from "./lib.ts";`;

  it("measures a name the module exports", async () => {
    const m = await measureEntry(entry("present"), dir, {
      missingIsNull: true,
    });
    expect(m?.minified).toBeGreaterThan(0);
  });

  it("returns null for a missing name when a missing name is allowed (the previous release)", async () => {
    await expect(
      measureEntry(entry("notAFunction"), dir, { missingIsNull: true }),
    ).resolves.toBeNull();
  });

  it("throws for a missing name when it is not allowed (the shipped set)", async () => {
    await expect(
      measureEntry(entry("notAFunction"), dir, { missingIsNull: false }),
    ).rejects.toThrow(/No matching export/);
  });
});

// The Dox build runs the script from apps/dox, where esbuild's paths are relative to apps/dox, not
// the repository root.
describe("bundle-size.mjs report", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bundle-size-report-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const appDir = path.resolve(import.meta.dirname, "../..");
  const script = path.resolve(appDir, "../../scripts/bundle-size.mjs");

  it.each`
    from          | cwd
    ${"apps/dox"} | ${appDir}
    ${"the root"} | ${path.resolve(appDir, "../..")}
  `(
    "reads the previous polyfill's version when run from $from",
    ({ cwd }) => {
      const out = path.join(dir, `${path.basename(cwd)}.json`);
      execFileSync(process.execPath, [script, "report", "--json", out], {
        cwd,
        stdio: "ignore",
      });
      const report = JSON.parse(readFileSync(out, "utf8"));
      expect(
        report.polyfills.map((p: { package: string }) => p.package),
      ).toEqual(["temporal-polyfill", "@js-temporal/polyfill"]);
      expect(report.polyfills[1].version).toMatch(/^\d+\.\d+\.\d+$/);
    },
    60_000,
  );
});
