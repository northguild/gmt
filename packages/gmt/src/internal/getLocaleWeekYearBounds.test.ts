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
    const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
      date,
      1,
      4,
    );
    expect(date.add({ days: startOffsetDays }).dayOfWeek).toBe(1);
    expect(date.add({ days: endOffsetDays }).dayOfWeek).toBe(1);
    expect((endOffsetDays - startOffsetDays) % 7).toBe(0);
  });

  it("[start, end) bounds contain the source date", () => {
    const date = Temporal.PlainDate.from("2024-06-15");
    const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
      date,
      1,
      4,
    );
    expect(startOffsetDays).toBeLessThanOrEqual(0);
    expect(endOffsetDays).toBeGreaterThan(0);
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
    expect(bounds.startOffsetDays).toBe(0);
  });

  it("computes a 53-week year's bounds spanning 371 days", () => {
    const date = Temporal.PlainDate.from("2020-06-15");
    const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
      date,
      1,
      4,
    );
    const days = endOffsetDays - startOffsetDays;
    expect(days).toBe(53 * 7);
  });

  it("computes a common 52-week year's bounds spanning 364 days", () => {
    const date = Temporal.PlainDate.from("2024-06-15");
    const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
      date,
      1,
      4,
    );
    const days = endOffsetDays - startOffsetDays;
    expect(days).toBe(52 * 7);
  });

  // Range edges: offsets from days-from-civil epoch days (not GMT). Under Sunday-first, minimalDays
  // 4, week 1 of -271821 starts on epoch day -100,000,107 and of -271820 on -99,999,743; the first
  // PlainDate is day -100,000,001. Week 1 of 275760 starts on day 99,999,742 and of 275761 on
  // 100,000,113; the last PlainDate is day 100,000,000. Both neighbouring starts lie outside.
  it.each`
    value              | weekYear   | startOffsetDays | endOffsetDays
    ${"-271821-04-19"} | ${-271821} | ${-106}         | ${258}
    ${"+275760-09-13"} | ${275760}  | ${-258}         | ${113}
  `(
    "returns week-year $weekYear with offsets [$startOffsetDays, $endOffsetDays) for the range-edge date $value",
    ({ value, weekYear, startOffsetDays, endOffsetDays }) => {
      expect(
        getLocaleWeekYearBounds(Temporal.PlainDate.from(value), 7, 4),
      ).toEqual({ weekYear, startOffsetDays, endOffsetDays });
    },
  );
});
