import { Temporal } from "@js-temporal/polyfill";
import { getLocaleWeekYearBounds } from "./getLocaleWeekYearBounds";

describe("getLocaleWeekYearBounds", () => {
  // firstDay=1 (Monday), minimalDays=4 reproduces the ISO 8601 rule —
  // cross-checked against Temporal's own built-in `yearOfWeek`.
  it.each`
    value           | expectedWeekYear
    ${"2024-06-15"} | ${2024}
    ${"2024-12-30"} | ${2025}
    ${"2021-01-01"} | ${2020}
    ${"2020-12-31"} | ${2020}
  `(
    "reproduces ISO yearOfWeek for $value under firstDay=1, minimalDays=4",
    ({ value, expectedWeekYear }) => {
      const date = Temporal.PlainDate.from(value);
      expect(getLocaleWeekYearBounds(date, 1, 4).weekYear).toBe(
        expectedWeekYear,
      );
      expect(date.yearOfWeek).toBe(expectedWeekYear);
    },
  );

  it("returns a start that always falls on firstDay, and an end exactly 7*n days later", () => {
    const date = Temporal.PlainDate.from("2024-06-15");
    const { start, end } = getLocaleWeekYearBounds(date, 1, 4);
    expect(start.dayOfWeek).toBe(1);
    expect(end.dayOfWeek).toBe(1);
    const days = start.until(end, { largestUnit: "days" }).days;
    expect(days % 7).toBe(0);
  });

  it("[start, end) bounds contain the source date", () => {
    const date = Temporal.PlainDate.from("2024-06-15");
    const { start, end } = getLocaleWeekYearBounds(date, 1, 4);
    expect(Temporal.PlainDate.compare(start, date)).toBeLessThanOrEqual(0);
    expect(Temporal.PlainDate.compare(date, end)).toBeLessThan(0);
  });

  // en-US: firstDay=7 (Sunday), minimalDays=1 — Jan 1 is always week 1.
  it("puts Jan 1 in the current calendar year's week-year when minimalDays=1", () => {
    const date = Temporal.PlainDate.from("2022-01-01");
    expect(getLocaleWeekYearBounds(date, 7, 1).weekYear).toBe(2022);
  });

  // The same date can disagree between rule sets near a year boundary.
  it("disagrees with the ISO rule on 2022-01-01 (Saturday): minimalDays=1 says 2022, minimalDays=4 says 2021", () => {
    const date = Temporal.PlainDate.from("2022-01-01");
    expect(getLocaleWeekYearBounds(date, 7, 1).weekYear).toBe(2022);
    expect(getLocaleWeekYearBounds(date, 1, 4).weekYear).toBe(2021);
  });

  it("resolves a date belonging to the *next* week-year (Dec 29-31 pulled forward)", () => {
    // 2024-12-30 is a Monday; under ISO rules it starts week 1 of 2025,
    // even though its calendar year is still 2024.
    const date = Temporal.PlainDate.from("2024-12-30");
    const bounds = getLocaleWeekYearBounds(date, 1, 4);
    expect(bounds.weekYear).toBe(2025);
    expect(Temporal.PlainDate.compare(bounds.start, date)).toBe(0);
  });

  it("computes a 53-week year's bounds spanning 371 days", () => {
    const date = Temporal.PlainDate.from("2020-06-15");
    const { start, end } = getLocaleWeekYearBounds(date, 1, 4);
    const days = start.until(end, { largestUnit: "days" }).days;
    expect(days).toBe(53 * 7);
  });

  it("computes a common 52-week year's bounds spanning 364 days", () => {
    const date = Temporal.PlainDate.from("2024-06-15");
    const { start, end } = getLocaleWeekYearBounds(date, 1, 4);
    const days = start.until(end, { largestUnit: "days" }).days;
    expect(days).toBe(52 * 7);
  });
});
