import { Temporal } from "./temporal";
import {
  fiscalPeriodOfWeek,
  fiscalYearEndIn,
  fiscalYearLabel,
  fiscalYearOf,
  gregorianCycleShift,
} from "./fiscalCalendar";

/** The Saturday nearest January 31 — the NRF (US) 4-5-4 year end, stated as a date. */
const nrfAnchor = Temporal.PlainDate.from("2026-01-31");

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

  // Temporal "constrain": a Feb-29 anchor targets Feb 28 in common years, then shifts to Thursday.
  it.each`
    year    | expected
    ${2023} | ${"2023-03-02"}
    ${2024} | ${"2024-02-29"}
    ${2025} | ${"2025-02-27"}
    ${2026} | ${"2026-02-26"}
    ${2027} | ${"2027-02-25"}
    ${2028} | ${"2028-03-02"}
  `(
    "puts the year end of a 2024-02-29 anchor falling in $year on $expected",
    ({ year, expected }) => {
      const anchor = Temporal.PlainDate.from("2024-02-29");

      expect(fiscalYearEndIn(anchor, year).toString()).toBe(expected);
    },
  );

  it("targets February 28, not a leap-year February 29, for a 2025-02-28 anchor in 2028", () => {
    // A month-end rule would target 2028-02-29; Temporal keeps the month-day, giving 2028-02-25.
    const anchor = Temporal.PlainDate.from("2025-02-28");

    expect(fiscalYearEndIn(anchor, 2028).toString()).toBe("2028-02-25");
  });

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
    ${"2023-01-28"} | ${"2022-01-30"} | ${52}
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

  // Far from the anchor the rule still holds: 1970-01-31 and 2099-01-31 are Saturdays, and
  // the Saturdays nearest 31 January 1971 and 2100 are the 30th, so both years are 52 weeks.
  it.each`
    value           | start           | weeks | description
    ${"1970-06-15"} | ${"1970-02-01"} | ${52} | ${"decades before the anchor"}
    ${"2099-06-15"} | ${"2099-02-01"} | ${52} | ${"decades after it"}
  `(
    "puts $value in the fiscal year starting $start, of $weeks weeks ($description)",
    ({ value, start, weeks }) => {
      expect(fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor)).toEqual({
        start: Temporal.PlainDate.from(start),
        weeks,
      });
    },
  );

  // Temporal's first and last dates, moved 685 cycles on and 684 back (146,097 days a cycle),
  // as getFiscalPeriod moves them. Here the whole fiscal year exists, as it does not at -271821
  // and +275760.
  it.each`
    value           | start           | weeks | description
    ${"2179-04-19"} | ${"2179-01-31"} | ${52} | ${"-271821-04-19, in the year opening -271821-01-31"}
    ${"2160-09-13"} | ${"2160-02-03"} | ${52} | ${"+275760-09-13, in the year closing +275761-01-31"}
  `(
    "puts $value in the fiscal year starting $start, of $weeks weeks (as $description)",
    ({ value, start, weeks }) => {
      expect(fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor)).toEqual({
        start: Temporal.PlainDate.from(start),
        weeks,
      });
    },
  );

  // The caller moves a date into 2000 to 2399 first. Unmoved, the search reaches a year end
  // outside Temporal's range, and Temporal throws.
  it.each`
    value              | description
    ${"-271820-06-01"} | ${"the search passes the year end in -271821, before the first date"}
    ${"-271821-04-19"} | ${"the year end before it, -271821-01-30, is before the first date"}
    ${"+275760-09-13"} | ${"the year end after it, +275761-01-31, is after the last date"}
  `("throws RangeError for $value ($description)", ({ value }) => {
    expect(() =>
      fiscalYearOf(Temporal.PlainDate.from(value), nrfAnchor),
    ).toThrow(RangeError);
  });
});

describe("gregorianCycleShift", () => {
  // The result moves a year into 2000 to 2399 at the same place in the 400-year cycle.
  it.each`
    year       | expected   | description
    ${2000}    | ${0}       | ${"the cycle's first year"}
    ${2399}    | ${0}       | ${"its last year"}
    ${2400}    | ${400}     | ${"one cycle on: sits where 2000 does"}
    ${1999}    | ${-400}    | ${"one cycle back: sits where 2399 does"}
    ${-271820} | ${-274000} | ${"sits where 2180 does"}
    ${275760}  | ${273600}  | ${"sits where 2160 does"}
  `("returns $expected for $year ($description)", ({ year, expected }) => {
    expect(gregorianCycleShift(year)).toBe(expected);
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
        fiscalPeriodOfWeek(index + 1, 52, pattern, "lastPeriod"),
      );

      expect(layout).toEqual(expected);
    },
  );

  /** Weeks in each of the 12 periods, counted from a whole-year walk. */
  const periodLengths = (
    weeks: number,
    pattern: "4-5-4" | "4-4-5" | "5-4-4",
    extraWeek: "firstPeriod" | "lastPeriod",
  ) => {
    const lengths = Array.from({ length: 12 }, () => 0);
    for (let week = 1; week <= weeks; week++) {
      lengths[fiscalPeriodOfWeek(week, weeks, pattern, extraWeek) - 1]++;
    }
    return lengths;
  };

  // The 53rd week lengthens period 1 or period 12, nothing else, and the caller states which
  // (CORE-5.md, Corrections).
  // ONS (UK) 2025 is the 4-4-5 firstPeriod shape: 5,4,5 then 4,4,5 three times.
  it.each`
    pattern    | extraWeek        | expected
    ${"4-5-4"} | ${"firstPeriod"} | ${[5, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4]}
    ${"4-5-4"} | ${"lastPeriod"}  | ${[4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 5]}
    ${"4-4-5"} | ${"firstPeriod"} | ${[5, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]}
    ${"4-4-5"} | ${"lastPeriod"}  | ${[4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6]}
    ${"5-4-4"} | ${"firstPeriod"} | ${[6, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4]}
    ${"5-4-4"} | ${"lastPeriod"}  | ${[5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 5]}
  `(
    "lays out a 53-week year under $pattern with extraWeek $extraWeek as $expected",
    ({ pattern, extraWeek, expected }) => {
      expect(periodLengths(53, pattern, extraWeek)).toEqual(expected);
    },
  );

  it.each`
    pattern
    ${"4-5-4"}
    ${"4-4-5"}
    ${"5-4-4"}
  `(
    "lays out a 52-week year under $pattern the same for either extraWeek",
    ({ pattern }) => {
      const walk = (extraWeek: "firstPeriod" | "lastPeriod") =>
        Array.from({ length: 52 }, (_unused, index) =>
          fiscalPeriodOfWeek(index + 1, 52, pattern, extraWeek),
        );

      expect(walk("firstPeriod")).toEqual(walk("lastPeriod"));
    },
  );

  it("clamps a week past the end of the year to the final period", () => {
    expect(fiscalPeriodOfWeek(53, 52, "4-5-4", "lastPeriod")).toBe(12);
  });
});

describe("fiscalYearLabel", () => {
  // Day counts per calendar year are worked by month length in each row's description.
  it.each`
    start           | end             | label             | expected | description
    ${"2024-12-29"} | ${"2026-01-03"} | ${"startYear"}    | ${2024}  | ${"ONS (UK) 2025 starts in 2024"}
    ${"2024-12-29"} | ${"2026-01-03"} | ${"endYear"}      | ${2026}  | ${"and ends in 2026"}
    ${"2024-12-29"} | ${"2026-01-03"} | ${"majorityYear"} | ${2025}  | ${"3 days in 2024, 365 in 2025, 3 in 2026: the published label"}
    ${"2019-12-29"} | ${"2021-01-02"} | ${"startYear"}    | ${2019}  | ${"ONS (UK) 2020 starts in 2019"}
    ${"2019-12-29"} | ${"2021-01-02"} | ${"endYear"}      | ${2021}  | ${"and ends in 2021"}
    ${"2019-12-29"} | ${"2021-01-02"} | ${"majorityYear"} | ${2020}  | ${"3 days in 2019, 366 in 2020, 2 in 2021: the published label"}
    ${"2023-06-26"} | ${"2024-06-30"} | ${"startYear"}    | ${2023}  | ${"a June year end starts in 2023"}
    ${"2023-06-26"} | ${"2024-06-30"} | ${"endYear"}      | ${2024}  | ${"and ends in 2024"}
    ${"2023-06-26"} | ${"2024-06-30"} | ${"majorityYear"} | ${2023}  | ${"5 + 184 = 189 days in 2023, 182 in 2024"}
    ${"2023-01-29"} | ${"2024-02-03"} | ${"startYear"}    | ${2023}  | ${"NRF (US) fiscal 2023: the published label"}
    ${"2023-01-29"} | ${"2024-02-03"} | ${"majorityYear"} | ${2023}  | ${"337 days in 2023, 34 in 2024"}
    ${"2025-07-03"} | ${"2026-07-01"} | ${"startYear"}    | ${2025}  | ${"a tie year starts in 2025"}
    ${"2025-07-03"} | ${"2026-07-01"} | ${"endYear"}      | ${2026}  | ${"and ends in 2026"}
    ${"2025-07-03"} | ${"2026-07-01"} | ${"majorityYear"} | ${2026}  | ${"182 days in 2025, 182 in 2026: a tie goes to the end year"}
    ${"2024-07-04"} | ${"2025-07-02"} | ${"majorityYear"} | ${2025}  | ${"181 days in 2024, 183 in 2025"}
    ${"2026-07-02"} | ${"2027-06-30"} | ${"majorityYear"} | ${2026}  | ${"183 days in 2026, 181 in 2027"}
    ${"2023-12-31"} | ${"2024-12-28"} | ${"startYear"}    | ${2023}  | ${"ONS (UK) 2024 starts on 31 December 2023"}
    ${"2023-12-31"} | ${"2024-12-28"} | ${"endYear"}      | ${2024}  | ${"and ends in 2024"}
    ${"2023-12-31"} | ${"2024-12-28"} | ${"majorityYear"} | ${2024}  | ${"1 day in 2023, 363 in 2024: the published label"}
    ${"2023-01-01"} | ${"2023-12-30"} | ${"startYear"}    | ${2023}  | ${"a year inside one calendar year"}
    ${"2023-01-01"} | ${"2023-12-30"} | ${"endYear"}      | ${2023}  | ${"has one label"}
    ${"2023-01-01"} | ${"2023-12-30"} | ${"majorityYear"} | ${2023}  | ${"under every rule"}
  `(
    "labels $start to $end as $expected under $label ($description)",
    ({ start, end, label, expected }) => {
      expect(
        fiscalYearLabel(
          Temporal.PlainDate.from(start),
          Temporal.PlainDate.from(end),
          label,
        ),
      ).toBe(expected);
    },
  );
});
