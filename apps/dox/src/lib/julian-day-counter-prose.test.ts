/**
 * The Julian Day Counter's page states figures in prose. This guard reads the page as text and
 * holds each figure to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lib } from "~/test/day-count-lib";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/julian-day-counter.mdx"),
  "utf8",
);

describe("the key point", () => {
  it("a JD day begins at noon and an MJD day at midnight", () => {
    expect(lib.toJulianDate("2026-01-01T12:00:00Z", "UTC")! % 1).toBe(0);
    expect(lib.toJulianDate("2026-01-01T00:00:00Z", "UTC")! % 1).toBe(0.5);
    expect(lib.toModifiedJulianDate("2026-01-01T00:00:00Z", "UTC")! % 1).toBe(
      0,
    );
    expect(page).toContain(
      "A JD day begins at noon and an MJD day at midnight",
    );
  });

  it("a single double holds a JD only to about 40 µs", () => {
    const noon = "2026-01-01T12:00:00Z";
    const base = lib.toJulianDate(noon, "UTC");
    let first = 0;
    for (let micros = 1; micros < 100 && first === 0; micros++) {
      const text = `2026-01-01T12:00:00.${String(micros).padStart(6, "0")}Z`;
      if (lib.toJulianDate(text, "UTC") !== base) first = micros;
    }
    // The first microsecond a double can tell apart is half its step; the step is the figure.
    expect(Math.round((first * 2) / 10) * 10).toBe(40);
    expect(page).toContain("only to about 40 µs");
  });
});

describe("the examples", () => {
  const quoted = (fn: string): string[] =>
    page
      .split("\n")
      .filter((l) => l.startsWith(`${fn}(`))
      .map((l) => l);

  it("shows the results the library returns", () => {
    const noon = "2026-01-01T12:00:00Z";
    expect(page).toContain(`// ${lib.toJulianDate(noon, "UTC")}\n`);
    expect(page).toContain(`// ${lib.toJulianDate(noon, "TT")}\n`);
    expect(page).toContain(`// ${lib.toModifiedJulianDate(noon, "UTC")}\n`);
    expect(page).toContain(`// ${lib.toJ2000Seconds(noon, "UTC")}\n`);
    expect(page).toContain(`// ${lib.toJ2000Seconds(noon, "TT")}\n`);
    expect(page).toContain(`// "${lib.fromJulianDate(2451545, "TT")}"`);
    expect(page).toContain(
      `// "${lib.fromJulianDateParts({ jd1: 2461041, jd2: 0.5 }, "UTC")}"`,
    );
    expect(quoted("toJulianDate").length).toBeGreaterThan(0);
  });

  it("two parts keep the twenty microseconds", () => {
    const parts = lib.toJulianDateParts("2026-01-01T12:00:00.00002Z", "UTC")!;
    expect(page).toContain(`jd2: ${parts.jd2} }`);
  });
});

describe("worth trying", () => {
  it("a before-1972 instant has no day count", () => {
    expect(lib.toJulianDateParts("1971-12-31T23:59:59Z", "UTC")).toBeNull();
  });

  it("two parts read as midnight at the start of 2026", () => {
    expect(lib.fromJulianDateParts({ jd1: 2461041, jd2: 0.5 }, "UTC")).toBe(
      "2026-01-01T00:00:00Z",
    );
    expect(page).toContain("midnight at the start of 2026");
  });
});
