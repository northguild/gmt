import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import record from "./moment-downloads.json";
import { downloadBars, roundedCount } from "./moment";

const script = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../../scripts/zone-matrix/npm-downloads.mjs",
  ),
  "utf8",
);

describe("the download record", () => {
  it("names its source and the day it was taken", () => {
    expect(record.source).toMatch(
      /^https:\/\/api\.npmjs\.org\/downloads\/point\//,
    );
    expect(record.package).toBe("moment");
    expect(record.capturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Run `cd scripts/zone-matrix && fnm exec --using=26 -- node npm-downloads.mjs`.
    expect(record.command).toContain("npm-downloads.mjs");
    expect(script).toContain(record.command);
  });

  it("holds one calendar year after another, only the last still running, ending before the capture day", () => {
    const years = record.years;
    expect(years[0]!.year).toBe(2019);
    years.forEach((y, i) => {
      expect(y.from).toBe(`${y.year}-01-01`);
      expect(y.partial).toBe(i === years.length - 1);
      expect(Number.isInteger(y.downloads)).toBe(true);
      if (i > 0) expect(y.year).toBe(years[i - 1]!.year + 1);
    });
    // The running year ends on the day before the capture, ISO dates sorting as text.
    expect(years.at(-1)!.to < record.capturedOn).toBe(true);
    expect(years.at(-1)!.to.slice(0, 4)).toBe(record.capturedOn.slice(0, 4));
  });
});

describe("the download bars", () => {
  it("rounds to whole millions, then to two places in billions", () => {
    expect(roundedCount(452_831_986)).toBe("453 million");
    expect(roundedCount(1_236_523_998)).toBe("1.24 billion");
  });

  it("gives one bar per year, the longest at full length, and marks the running year", () => {
    const bars = downloadBars();
    expect(bars).toHaveLength(record.years.length);
    expect(Math.max(...bars.map((b) => b.share))).toBe(1);
    expect(bars[0]).toMatchObject({ name: "2019", value: "453 million" });
    expect(bars.at(-1)).toMatchObject({
      name: "2026",
      value: "1.59 billion",
      note: "so far",
    });
    expect(bars.filter((b) => b.note !== undefined)).toHaveLength(1);
  });

  it("refuses a record with a gap or a finished last year", () => {
    const year = (n: number, partial: boolean) => ({
      year: n,
      from: "",
      to: "",
      partial,
      downloads: 1,
    });
    expect(() => downloadBars([year(2019, false), year(2021, true)])).toThrow(
      /does not follow/,
    );
    expect(() => downloadBars([year(2019, false), year(2020, false)])).toThrow(
      /only the last year is partial/,
    );
    expect(() => downloadBars([])).toThrow(/no years/);
  });
});
