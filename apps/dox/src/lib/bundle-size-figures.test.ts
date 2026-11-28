import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import live from "../generated/bundle-size.json";
import {
  chartRows,
  comparisonRows,
  formatBytes,
  leadFigures,
  polyfillSets,
  smallestFunction,
  splitOf,
  type BundleReport,
} from "./bundle-size-figures";
import { FIXTURE_FLOOR, fixtureReport } from "./bundle-size-figures.fixture";

const NBSP = " ";

describe("polyfillSets", () => {
  it("finds the sets by the flag when the previous set is listed first", () => {
    const { shipped, previous } = polyfillSets(fixtureReport());
    expect(shipped.package).toBe("alpha-poly");
    expect(previous.package).toBe("beta-poly");
  });

  it("throws for zero shipped sets", () => {
    const report = fixtureReport();
    for (const set of report.polyfills ?? []) set.shipped = false;
    expect(() => polyfillSets(report)).toThrow(/shipped/);
  });

  it("throws for two shipped sets", () => {
    const report = fixtureReport();
    for (const set of report.polyfills ?? []) set.shipped = true;
    expect(() => polyfillSets(report)).toThrow(/shipped/);
  });

  it("throws for a report with no polyfills", () => {
    const { polyfills: _dropped, ...rest } = fixtureReport();
    expect(() => polyfillSets(rest as BundleReport)).toThrow(/polyfills/);
  });
});

describe("formatBytes", () => {
  it("writes bytes under 1,000 and kB from 1,000, with a no-break space", () => {
    expect(formatBytes(0)).toBe(`0${NBSP}B`);
    expect(formatBytes(999)).toBe(`999${NBSP}B`);
    expect(formatBytes(1000)).toBe(`1.0${NBSP}kB`);
    expect(formatBytes(23_349)).toBe(`23.3${NBSP}kB`);
  });
});

describe("splitOf", () => {
  const { shipped } = polyfillSets(fixtureReport());

  it("splits each measure into total, floor and the code above the floor", () => {
    expect(splitOf(shipped, "fnBig", FIXTURE_FLOOR)).toEqual({
      minified: { total: 9000, floor: 5000, code: 4000 },
      gzipped: { total: 3400, floor: 2000, code: 1400 },
    });
  });

  it("is null for a null entry and for a missing one", () => {
    const { previous } = polyfillSets(fixtureReport());
    expect(splitOf(previous, "fnMid", FIXTURE_FLOOR)).toBeNull();
    expect(splitOf(previous, "absent", FIXTURE_FLOOR)).toBeNull();
  });
});

describe("comparisonRows and chartRows", () => {
  it("keep the shipped-set order, drop the floor and keep root", () => {
    expect(comparisonRows(fixtureReport()).map((r) => r.name)).toEqual([
      "root",
      "fnSmall",
      "fnMid",
      "fnBig",
    ]);
  });

  it("hold a null previous split where the previous set lacks the entry", () => {
    const rows = comparisonRows(fixtureReport());
    expect(rows.find((r) => r.name === "fnMid")?.previous).toBeNull();
    expect(rows.find((r) => r.name === "fnBig")?.previous).not.toBeNull();
  });

  it("chartRows also drops root and the null row", () => {
    expect(chartRows(fixtureReport()).map((r) => r.name)).toEqual([
      "fnSmall",
      "fnBig",
    ]);
  });
});

describe("smallestFunction", () => {
  it("ignores root and the floor, even though the floor is smaller", () => {
    expect(smallestFunction(fixtureReport())).toBe("fnSmall");
  });
});

describe("the figures follow the data", () => {
  it("changes leadFigures and comparisonRows with one byte count", () => {
    const before = fixtureReport();
    const after = fixtureReport();
    const shipped = after.polyfills?.find((p) => p.shipped);
    if (!shipped?.entries.base) throw new Error("fixture has no base");
    shipped.entries.base.gzipped = 2500;
    expect(leadFigures(after).floorGzipped).not.toBe(
      leadFigures(before).floorGzipped,
    );
    expect(comparisonRows(after)).not.toEqual(comparisonRows(before));
  });

  it("holds the renamed package, and not the old name, in every output", () => {
    const report = fixtureReport();
    const shipped = report.polyfills?.find((p) => p.shipped);
    if (!shipped) throw new Error("fixture has no shipped set");
    shipped.package = "gamma-poly";
    shipped.import = "gamma-poly/full";
    const everything = JSON.stringify([
      leadFigures(report),
      comparisonRows(report),
      polyfillSets(report),
    ]);
    expect(everything).toContain("gamma-poly");
    expect(everything).not.toContain("alpha-poly");
  });

  it("states the lead figures from the fixture", () => {
    const figures = leadFigures(fixtureReport());
    expect(figures).toMatchObject({
      shippedVersion: "2.0.0",
      previousVersion: "0.5.1",
      previousGmt: "9.9.9",
      floorGzipped: `2.0${NBSP}kB`,
      previousFloorGzipped: `4.8${NBSP}kB`,
      floorDifferenceGzipped: `2.8${NBSP}kB`,
      floorDifferenceMinified: `7.0${NBSP}kB`,
      smallestName: "fnSmall",
      smallestCodeMinified: `800${NBSP}B`,
      smallestCodeGzipped: `300${NBSP}B`,
      smallestTotalGzipped: `2.3${NBSP}kB`,
      largestName: "fnBig",
      largestCodeGzipped: `1.4${NBSP}kB`,
      rootGzipped: `15.0${NBSP}kB`,
      previousRootGzipped: `17.8${NBSP}kB`,
    });
  });

  it("names how the previous set was measured by the field", () => {
    const report = fixtureReport();
    expect(leadFigures(report).previousMeasuredFrom).toBe("the published");
    const previous = report.polyfills?.find((p) => !p.shipped);
    if (!previous) throw new Error("fixture has no previous set");
    previous.from = "source";
    expect(leadFigures(report).previousMeasuredFrom).toBe("the source of");
  });

  it("never prints the shipped set's GMT version", () => {
    const report = fixtureReport();
    const shipped = report.polyfills?.find((p) => p.shipped);
    if (!shipped) throw new Error("fixture has no shipped set");
    shipped.gmt = "7.7.7";
    expect(JSON.stringify(leadFigures(report))).not.toContain("7.7.7");
  });
});

describe("the module states no name of its own", () => {
  it("holds no package name and no entry name from the live JSON", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "bundle-size-figures.ts"),
      "utf8",
    );
    const { polyfills, entries } = live as unknown as BundleReport;
    for (const set of polyfills ?? []) {
      expect(source).not.toContain(set.package);
    }
    const quoted = Object.keys(entries).filter((name) => name !== "root");
    for (const name of quoted) {
      expect(source).not.toMatch(new RegExp(`["'\`]${name}["'\`]`));
    }
  });
});

describe("the live report", () => {
  const report = live as unknown as BundleReport;

  it("has two sets whose entries are the top-level entries (slice 6 landed)", () => {
    const { shipped, previous } = polyfillSets(report);
    const keys = Object.keys(report.entries);
    expect(Object.keys(shipped.entries)).toEqual(keys);
    expect(Object.keys(previous.entries)).toEqual(keys);
  });

  it("makes the polyfill the larger part of almost every import", () => {
    const { shipped } = polyfillSets(report);
    const rows = comparisonRows(report);
    const polyfillLarger = rows.filter((row) => {
      const split = splitOf(shipped, row.name, report.floor);
      return split !== null && split.gzipped.floor > split.gzipped.code;
    });
    expect(polyfillLarger.length).toBeGreaterThanOrEqual(rows.length - 1);
  });
});
