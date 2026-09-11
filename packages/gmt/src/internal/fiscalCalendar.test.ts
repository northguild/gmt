import { Temporal } from "@js-temporal/polyfill";
import {
  fiscalPeriodOfWeek,
  fiscalYearEndIn,
  fiscalYearOf,
  isFiscalPattern,
} from "./fiscalCalendar";

/** "The Saturday nearest to January 31" — the NRF 4-5-4 rule, stated as a date. */
const nrfAnchor = Temporal.PlainDate.from("2026-01-31");

describe("isFiscalPattern", () => {
  it.each`
    value        | expected
    ${"4-5-4"}   | ${true}
    ${"4-4-5"}   | ${true}
    ${"5-4-4"}   | ${true}
    ${"4-5-5"}   | ${false}
    ${"454"}     | ${false}
    ${"4-5-4 "}  | ${false}
    ${""}        | ${false}
    ${undefined} | ${false}
    ${null}      | ${false}
    ${454}       | ${false}
    ${["4-5-4"]} | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isFiscalPattern(value)).toBe(expected);
  });
});

describe("fiscalYearEndIn", () => {
  // Every year end the NRF publishes for its 4-5-4 calendar, 2017 through 2028.
  // https://nrf.com/resources/4-5-4-calendar
  it.each`
    year    | expected
    ${2018} | ${"2018-02-03"}
    ${2019} | ${"2019-02-02"}
    ${2020} | ${"2020-02-01"}
    ${2021} | ${"2021-01-30"}
    ${2022} | ${"2022-01-29"}
    ${2023} | ${"2023-01-28"}
    ${2024} | ${"2024-02-03"}
    ${2025} | ${"2025-02-01"}
    ${2026} | ${"2026-01-31"}
    ${2027} | ${"2027-01-30"}
    ${2028} | ${"2028-01-29"}
    ${2029} | ${"2029-02-03"}
  `(
    "puts the NRF year end falling in $year on $expected",
    ({ year, expected }) => {
      expect(fiscalYearEndIn(nrfAnchor, year).toString()).toBe(expected);
    },
  );

  it.each`
    year    | expected
    ${2018} | ${2017}
    ${2024} | ${2023}
    ${2029} | ${2028}
  `(
    "keeps every NRF year end on the anchor's weekday, in $year",
    ({ year }) => {
      expect(fiscalYearEndIn(nrfAnchor, year).dayOfWeek).toBe(
        nrfAnchor.dayOfWeek,
      );
    },
  );

  it("lands in the previous calendar year when the rule's month-day is early January", () => {
    // 2033-01-01 is a Saturday, so this states "the Saturday nearest to January 1".
    const anchor = Temporal.PlainDate.from("2033-01-01");

    expect(fiscalYearEndIn(anchor, 2024).toString()).toBe("2023-12-30");
    expect(fiscalYearEndIn(anchor, 2025).toString()).toBe("2025-01-04");
  });
});

describe("fiscalYearOf", () => {
  it.each`
    value           | start           | weeks
    ${"2023-01-29"} | ${"2023-01-29"} | ${53}
    ${"2024-02-03"} | ${"2023-01-29"} | ${53}
    ${"2024-02-04"} | ${"2024-02-04"} | ${52}
    ${"2025-02-01"} | ${"2024-02-04"} | ${52}
    ${"2025-02-02"} | ${"2025-02-02"} | ${52}
    ${"2017-01-29"} | ${"2017-01-29"} | ${53}
    ${"2028-01-30"} | ${"2028-01-30"} | ${53}
  `(
    "puts $value in the fiscal year starting $start, of $weeks weeks",
    ({ value, start, weeks }) => {
      expect(fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor)).toEqual({
        start: Temporal.PlainDate.from(start),
        weeks,
      });
    },
  );

  it.each`
    value           | description
    ${"2023-01-28"} | ${"the day before a fiscal year opens"}
    ${"2023-01-29"} | ${"the day it opens"}
  `(
    "keeps $value on the right side of the boundary ($description)",
    ({ value }) => {
      const result = fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor);

      expect(result?.start.toString()).toBe(
        value === "2023-01-28" ? "2022-01-30" : "2023-01-29",
      );
    },
  );

  it("searches back a calendar year when the rule puts an end in the following one", () => {
    // 2022-12-31 is a Saturday, so this states "the Saturday nearest to December 31" — and the
    // year for 2021 ends on 2022-01-01, a calendar year later than the one it is named for.
    const anchor = Temporal.PlainDate.from("2022-12-31");

    expect(fiscalYearEndIn(anchor, 2021).toString()).toBe("2022-01-01");
    expect(fiscalYearOf(Temporal.PlainDate.from("2022-01-01"), anchor)).toEqual(
      { start: Temporal.PlainDate.from("2021-01-03"), weeks: 52 },
    );
  });

  it("searches forward two calendar years when a year end lands in late December", () => {
    // "The Saturday nearest to January 1" puts fiscal 2022's end on 2023-12-30, before
    // 2023-12-31 — so the year bounding that date is the one ending 2025-01-04.
    const anchor = Temporal.PlainDate.from("2033-01-01");

    expect(fiscalYearEndIn(anchor, 2024).toString()).toBe("2023-12-30");
    expect(fiscalYearEndIn(anchor, 2025).toString()).toBe("2025-01-04");
    expect(fiscalYearOf(Temporal.PlainDate.from("2023-12-31"), anchor)).toEqual(
      { start: Temporal.PlainDate.from("2023-12-31"), weeks: 53 },
    );
  });

  it("finds the year when the rule puts its end in the previous calendar year", () => {
    const anchor = Temporal.PlainDate.from("2033-01-01");

    expect(fiscalYearOf(Temporal.PlainDate.from("2024-01-01"), anchor)).toEqual(
      { start: Temporal.PlainDate.from("2023-12-31"), weeks: 53 },
    );
  });

  it.each`
    value           | description
    ${"1970-06-15"} | ${"decades before the anchor"}
    ${"2099-06-15"} | ${"decades after it"}
  `("still resolves $value ($description)", ({ value }) => {
    const result = fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor);

    expect(result?.weeks === 52 || result?.weeks === 53).toBe(true);
  });
});

describe("fiscalPeriodOfWeek", () => {
  it.each`
    pattern    | expected
    ${"4-5-4"} | ${[1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 11, 12, 12, 12, 12]}
    ${"4-4-5"} | ${[1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12]}
    ${"5-4-4"} | ${[1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12]}
  `(
    "lays out all 52 weeks of a 52-week year under $pattern",
    ({ pattern, expected }) => {
      const layout = Array.from({ length: 52 }, (_unused, index) =>
        fiscalPeriodOfWeek(index + 1, 52, pattern),
      );

      expect(layout).toEqual(expected);
    },
  );

  it.each`
    pattern    | finalPeriodWeeks
    ${"4-5-4"} | ${5}
    ${"4-4-5"} | ${6}
    ${"5-4-4"} | ${5}
  `(
    "appends the 53rd week to period 12 under $pattern, making it $finalPeriodWeeks weeks long",
    ({ pattern, finalPeriodWeeks }) => {
      const weeksInFinalPeriod = Array.from({ length: 53 }, (_unused, index) =>
        fiscalPeriodOfWeek(index + 1, 53, pattern),
      ).filter((period) => period === 12).length;

      expect(weeksInFinalPeriod).toBe(finalPeriodWeeks);
      expect(fiscalPeriodOfWeek(53, 53, pattern)).toBe(12);
    },
  );

  it.each`
    pattern    | description
    ${"4-5-4"} | ${"the NRF shape"}
    ${"4-4-5"} | ${"the longer month at quarter end"}
    ${"5-4-4"} | ${"the longer month at quarter start"}
  `(
    "gives every quarter 13 weeks in a 52-week year under $pattern ($description)",
    ({ pattern }) => {
      const layout = Array.from({ length: 52 }, (_unused, index) =>
        fiscalPeriodOfWeek(index + 1, 52, pattern),
      );

      for (let quarter = 0; quarter < 4; quarter++) {
        const periods = [quarter * 3 + 1, quarter * 3 + 2, quarter * 3 + 3];
        const weeks = layout.filter((period) =>
          periods.includes(period),
        ).length;

        expect(weeks).toBe(13);
      }
    },
  );

  it("clamps a week past the end of the year to the final period", () => {
    expect(fiscalPeriodOfWeek(53, 52, "4-5-4")).toBe(12);
  });
});
