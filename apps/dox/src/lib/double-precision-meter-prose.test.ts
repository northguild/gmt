/**
 * The Double Precision Meter's page states figures in prose. This guard reads the page as text
 * and holds each figure to the measured samples or a library call, so the prose cannot drift
 * from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lib } from "~/test/day-count-lib";
import {
  meterSamples,
  stepYearOf,
  worstOf,
  yearAt,
  PROBES,
  type MeterSamples,
} from "./double-precision-meter";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/double-precision-meter.mdx"),
  "utf8",
);

const utc = meterSamples(lib, "UTC");

/** The worst single-JD drift among the samples for which `keep` is true. */
const worstJd = (data: MeterSamples, keep: (year: number) => boolean): bigint =>
  data.samples
    .filter((s) => keep(s.year))
    .reduce((a, s) => (s.ns.jd > a ? s.ns.jd : a), 0n);

describe("the key point", () => {
  it("says a single JD is off by up to about 20 µs, and about 40 µs from 6771", () => {
    const step = stepYearOf(lib, "UTC")!;
    // Half a double's spacing, from the library: 20 µs, then 40 µs once the spacing doubles.
    const before = worstJd(utc, (y) => y < step);
    const after = worstJd(utc, (y) => y >= step);
    expect(before).toBeGreaterThan(15_000n);
    expect(before).toBeLessThanOrEqual(20_118n);
    expect(after).toBeGreaterThan(30_000n);
    expect(after).toBeLessThanOrEqual(40_236n);
    expect(page).toContain(
      "up to about 20 µs, and by up to about 40 µs from 6771",
    );
  });

  it("puts the step in 6771, where the JD passes 2²² days", () => {
    expect(lib.fromJulianDate(2 ** 22, "UTC")).toMatch(/^6771-/);
    expect(page).toContain("passes 2²² days, in 6771");
  });

  it("says the two-part JD is exact", () => {
    expect(worstOf(utc, "parts").ns).toBe(0n);
    expect(page).toContain("The two-part JD is exact.");
  });

  it("states 20 µs as lost by a single JD and kept by the two parts", () => {
    const text = "2026-01-01T12:00:00.00002Z";
    expect(lib.toJulianDate(text, "UTC")).toBe(2461042);
    const parts = lib.toJulianDateParts(text, "UTC")!;
    expect(lib.fromJulianDateParts(parts, "UTC")).toBe(text);
    expect(page).toContain("Twenty microseconds");
  });
});

describe("the intro", () => {
  it("a JD near the present spends 7 digits on whole days", () => {
    const jd = lib.toJulianDate(yearAt(PROBES[0]!, 2026), "UTC")!;
    expect(String(Math.trunc(jd))).toHaveLength(7);
    expect(page).toContain("spends 7 of them on whole days");
  });

  it("an MJD keeps more of its digits for the fraction near the present", () => {
    const at = (form: "jd" | "mjd") =>
      utc.samples.find((s) => s.year === 2000)!.ns[form];
    const jd = lib.toJulianDate(yearAt(PROBES[0]!, 2026), "UTC")!;
    const mjd = lib.toModifiedJulianDate(yearAt(PROBES[0]!, 2026), "UTC")!;
    expect(String(Math.trunc(mjd)).length).toBeLessThan(
      String(Math.trunc(jd)).length,
    );
    expect(at("mjd")).toBeLessThanOrEqual(at("jd"));
  });

  it("J2000 seconds drift more the further the instant lies from 2000", () => {
    const at = (year: number) =>
      utc.samples.find((s) => s.year === year)!.ns.j2000;
    expect(at(9999)).toBeGreaterThan(at(2000));
    const zero = lib.toJ2000Seconds("2000-01-01T11:58:55.816Z", "TT");
    expect(zero).toBe(0);
    expect(page).toContain("exact at J2000.0 itself");
  });

  it("the plot's axis runs from 1 ns to 100 µs, which holds every measured drift", () => {
    for (const scale of ["UTC", "TAI", "TT", "TCG"] as const) {
      for (const s of meterSamples(lib, scale).samples) {
        for (const ns of Object.values(s.ns)) expect(ns).toBeLessThan(100_000n);
      }
    }
    expect(page).toContain("from 1 ns to 100 µs");
  });

  it("the range is 1972 to 9999", () => {
    expect(lib.toJulianDate("1972-01-01T00:00:00Z", "UTC")).not.toBeNull();
    expect(lib.toJulianDate("1971-12-31T23:59:59Z", "UTC")).toBeNull();
    expect(page).toContain("from 1972 to 9999");
  });
});

describe("the reference links", () => {
  it("name functions the library exports", () => {
    for (const name of [
      "toJulianDate",
      "fromJulianDate",
      "toModifiedJulianDate",
      "fromModifiedJulianDate",
      "toJ2000Seconds",
      "fromJ2000Seconds",
      "toJulianDateParts",
      "fromJulianDateParts",
    ]) {
      expect(page).toContain(`/reference/timescale/convert/${name}/`);
      expect(lib).toHaveProperty(name);
    }
  });
});
