import { addBusinessDays } from "../../plain/calculate/addBusinessDays";
import { Temporal } from "../../internal/temporal";
import { isBusinessDay } from "../../plain/compare/isBusinessDay";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import type { BusinessCalendarSpec, HolidayRule } from "../../types";
import { buildBusinessCalendar } from "./buildBusinessCalendar";

const SAT_FRI_SUN_MON = { 6: { previous: 5 }, 7: { next: 1 } } as const;
const NEXT_WORKING = {
  6: "nextWorkingDay",
  7: "nextWorkingDay",
} as const;

function spec(
  rules: HolidayRule[],
  from: number,
  to: number,
  overrides: Partial<BusinessCalendarSpec> = {},
): BusinessCalendarSpec {
  return {
    timeZone: "UTC",
    weekend: [6, 7],
    rules,
    years: { from, to },
    ...overrides,
  };
}

/** Every date from 2026-12-27 to 2027-01-`lastJanuaryDay`, by counting days of two known months. */
function closedRun(lastJanuaryDay: number): string[] {
  const days = [27, 28, 29, 30, 31].map((day) => `2026-12-${day}`);

  for (let day = 1; day <= lastJanuaryDay; day++) {
    days.push(`2027-01-${String(day).padStart(2, "0")}`);
  }

  return days;
}

// Weekdays (checked against a calendar): 2026-01-01 Thursday, 2026-04-03 Friday, 2026-07-04
// Saturday, 2026-08-15 Saturday, 2026-11-01 Sunday, 2026-12-25 Friday, 2026-12-26 Saturday,
// 2021-12-25 Saturday, 2021-12-26 Sunday, 2028-01-01 Saturday, 2026-06-17 Wednesday.
describe("buildBusinessCalendar", () => {
  describe("eleven rules, 2026", () => {
    const rules: HolidayRule[] = [
      { name: "a", kind: "fixed", month: 1, day: 1, observed: SAT_FRI_SUN_MON },
      { name: "b", kind: "nthWeekday", month: 1, weekday: 1, n: 3 },
      { name: "c", kind: "easterRelative", offsetDays: -2 },
      { name: "d", kind: "easterRelative", offsetDays: 1 },
      { name: "e", kind: "nthWeekday", month: 5, weekday: 1, n: "last" },
      { name: "f", kind: "fixed", month: 7, day: 4, observed: SAT_FRI_SUN_MON },
      { name: "g", kind: "nthWeekday", month: 9, weekday: 1, n: 1 },
      {
        name: "h",
        kind: "fixed",
        month: 8,
        day: 15,
        observed: { 6: { next: 1 }, 7: { next: 1 } },
      },
      {
        name: "i",
        kind: "fixed",
        month: 11,
        day: 1,
        observed: { 7: { next: 1 } },
      },
      { name: "j", kind: "fixed", month: 12, day: 25, observed: NEXT_WORKING },
      { name: "k", kind: "fixed", month: 12, day: 26, observed: NEXT_WORKING },
    ];
    const calendar = buildBusinessCalendar(spec(rules, 2026, 2026));

    it("holds the eleven observed dates, sorted", () => {
      expect(calendar).toEqual({
        weekend: [6, 7],
        holidays: [
          "2026-01-01",
          "2026-01-19",
          "2026-04-03",
          "2026-04-06",
          "2026-05-25",
          "2026-07-03",
          "2026-08-17",
          "2026-09-07",
          "2026-11-02",
          "2026-12-25",
          "2026-12-28",
        ],
        timeZone: "UTC",
      });
    });

    it.each`
      date            | open
      ${"2026-01-01"} | ${false}
      ${"2026-01-19"} | ${false}
      ${"2026-04-03"} | ${false}
      ${"2026-04-06"} | ${false}
      ${"2026-05-25"} | ${false}
      ${"2026-07-03"} | ${false}
      ${"2026-08-17"} | ${false}
      ${"2026-09-07"} | ${false}
      ${"2026-11-02"} | ${false}
      ${"2026-12-25"} | ${false}
      ${"2026-12-28"} | ${false}
      ${"2026-07-04"} | ${false}
      ${"2026-08-15"} | ${false}
      ${"2026-11-01"} | ${false}
      ${"2026-12-26"} | ${false}
      ${"2026-01-02"} | ${true}
      ${"2026-04-02"} | ${true}
      ${"2026-04-07"} | ${true}
      ${"2026-07-02"} | ${true}
      ${"2026-08-14"} | ${true}
      ${"2026-08-18"} | ${true}
      ${"2026-11-03"} | ${true}
      ${"2026-12-24"} | ${true}
      ${"2026-12-29"} | ${true}
    `(
      "isBusinessDay($date) is $open",
      ({ date, open }: { date: string; open: boolean }) => {
        expect(isBusinessDay(date, calendar!)).toBe(open);
      },
    );
  });

  it("builds six fixed and Easter-relative closing days for 2026", () => {
    const rules: HolidayRule[] = [
      { name: "New year", kind: "fixed", month: 1, day: 1 },
      {
        name: "Two days before Easter",
        kind: "easterRelative",
        offsetDays: -2,
      },
      { name: "Day after Easter", kind: "easterRelative", offsetDays: 1 },
      { name: "Spring day", kind: "fixed", month: 5, day: 1 },
      { name: "Winter day", kind: "fixed", month: 12, day: 25 },
      { name: "Day after winter day", kind: "fixed", month: 12, day: 26 },
    ];

    expect(
      buildBusinessCalendar(
        spec(rules, 2026, 2026, { timeZone: "Europe/Berlin" }),
      ),
    ).toEqual({
      weekend: [6, 7],
      holidays: [
        "2026-01-01",
        "2026-04-03",
        "2026-04-06",
        "2026-05-01",
        "2026-12-25",
        "2026-12-26",
      ],
      timeZone: "Europe/Berlin",
    });
  });

  // 2022-12-25 is a Sunday and 2022-12-26 a Monday; 2021-12-27 is a Monday.
  describe("rule order does not change the result", () => {
    const christmas: HolidayRule[] = [
      { name: "a", kind: "fixed", month: 12, day: 25, observed: NEXT_WORKING },
      { name: "b", kind: "fixed", month: 12, day: 26, observed: NEXT_WORKING },
    ];
    const sunday26: HolidayRule = {
      name: "A",
      kind: "fixed",
      month: 12,
      day: 26,
      observed: { 7: "nextWorkingDay" },
    };
    const monday27: HolidayRule = {
      name: "B",
      kind: "dates",
      dates: ["2021-12-27"],
    };
    const sunday26ToMonday: HolidayRule = {
      name: "C",
      kind: "fixed",
      month: 12,
      day: 26,
      observed: { 7: { next: 1 } },
    };

    it.each`
      label                                      | rules                               | year    | expected
      ${"Saturday 25 and Sunday 26, 2021"}       | ${christmas}                        | ${2021} | ${["2021-12-27", "2021-12-28"]}
      ${"Sunday 26 and Saturday 25, 2021"}       | ${[christmas[1], christmas[0]]}     | ${2021} | ${["2021-12-27", "2021-12-28"]}
      ${"Sunday 25 and Monday 26, 2022"}         | ${christmas}                        | ${2022} | ${["2022-12-26", "2022-12-27"]}
      ${"Monday 26 and Sunday 25, 2022"}         | ${[christmas[1], christmas[0]]}     | ${2022} | ${["2022-12-26", "2022-12-27"]}
      ${"shift first, then the closing day"}     | ${[sunday26, monday27]}             | ${2021} | ${["2021-12-27", "2021-12-28"]}
      ${"closing day first, then the shift"}     | ${[monday27, sunday26]}             | ${2021} | ${["2021-12-27", "2021-12-28"]}
      ${"walk first, then a next-Monday move"}   | ${[christmas[0], sunday26ToMonday]} | ${2021} | ${["2021-12-27", "2021-12-28"]}
      ${"next-Monday move first, then the walk"} | ${[sunday26ToMonday, christmas[0]]} | ${2021} | ${["2021-12-27", "2021-12-28"]}
    `("$label gives $expected", ({ rules, year, expected }) => {
      expect(buildBusinessCalendar(spec(rules, year, year))?.holidays).toEqual(
        expected,
      );
    });
  });

  it("keeps a date observed from the next year's occurrence", () => {
    const rules: HolidayRule[] = [
      {
        name: "a",
        kind: "fixed",
        month: 1,
        day: 1,
        observed: { 6: { previous: 5 } },
      },
    ];

    // 2028-01-01 is a Saturday: its observed day is 2027-12-31.
    expect(buildBusinessCalendar(spec(rules, 2027, 2027))?.holidays).toEqual([
      "2027-01-01",
      "2027-12-31",
    ]);
  });

  it("closes both dates when a rule is listed twice, once without observed", () => {
    const plain: HolidayRule = { name: "a", kind: "fixed", month: 6, day: 17 };
    const moved: HolidayRule = {
      ...plain,
      observed: { 3: { previous: 1 } },
    };
    const both = buildBusinessCalendar(spec([plain, moved], 2026, 2026));
    const alone = buildBusinessCalendar(spec([moved], 2026, 2026));

    expect(both?.holidays).toEqual(["2026-06-15", "2026-06-17"]);
    expect(alone?.holidays).toEqual(["2026-06-15"]);
    expect(isBusinessDay("2026-06-17", alone!)).toBe(true);
  });

  describe("span and shift limits", () => {
    const easter: HolidayRule = {
      name: "e",
      kind: "easterRelative",
      offsetDays: 0,
    };

    it("accepts 400 years and gives 400 Easters", () => {
      expect(
        buildBusinessCalendar(spec([easter], 2000, 2399))?.holidays,
      ).toHaveLength(400);
    });

    it("rejects 401 years", () => {
      expect(buildBusinessCalendar(spec([easter], 2000, 2400))).toBeNull();
    });

    it("has no holidays where Easter is outside Temporal's range", () => {
      expect(buildBusinessCalendar(spec([easter], -271_821, -271_821))).toEqual(
        { weekend: [6, 7], holidays: [], timeZone: "UTC" },
      );
    });

    it.each`
      label                       | rule                                     | from       | to
      ${"first year, 1 January"}  | ${{ kind: "fixed", month: 1, day: 1 }}   | ${-271821} | ${-271821}
      ${"last year, 31 December"} | ${{ kind: "fixed", month: 12, day: 31 }} | ${275760}  | ${275760}
    `("clips $label to Temporal's range", ({ rule, from, to }) => {
      expect(
        buildBusinessCalendar(spec([{ name: "x", ...rule }], from, to))
          ?.holidays,
      ).toEqual([]);
    });

    it("fails when a nextWorkingDay shift moves 37 days", () => {
      const rules: HolidayRule[] = [
        {
          name: "closed",
          kind: "dates",
          dates: closedRun(31),
        },
        {
          name: "a",
          kind: "fixed",
          month: 12,
          day: 26,
          observed: { 6: "nextWorkingDay" },
        },
      ];

      expect(buildBusinessCalendar(spec(rules, 2026, 2026))).toBeNull();
    });

    it("keeps a 30-day shift whose observed day falls outside the window", () => {
      const rules: HolidayRule[] = [
        {
          name: "closed",
          kind: "dates",
          dates: closedRun(24),
        },
        {
          name: "a",
          kind: "fixed",
          month: 12,
          day: 26,
          observed: { 6: "nextWorkingDay" },
        },
      ];

      expect(buildBusinessCalendar(spec(rules, 2026, 2026))?.holidays).toEqual([
        "2026-12-27",
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
      ]);
    });
  });

  describe("the expansion margin", () => {
    const saturdayShifts: HolidayRule = {
      name: "a",
      kind: "fixed",
      month: 12,
      day: 31,
      observed: { 6: { next: 1 } },
    };

    // 2022-12-31 is a Saturday: observed Monday 2023-01-02, inside a window that starts in 2023.
    it("keeps a date observed inside the window from the year before it", () => {
      expect(
        buildBusinessCalendar(spec([saturdayShifts], 2023, 2023))?.holidays,
      ).toEqual(["2023-01-02", "2023-12-31"]);
    });

    // 2022-12-24 is a Saturday: observed Friday 2022-12-23, before a window that starts in 2023.
    it("drops a date observed before the window from the year before it", () => {
      const rule: HolidayRule = {
        name: "a",
        kind: "fixed",
        month: 12,
        day: 24,
        observed: { 6: { previous: 5 } },
      };

      expect(buildBusinessCalendar(spec([rule], 2023, 2023))?.holidays).toEqual(
        ["2023-12-24"],
      );
    });

    // The walk from Saturday 2026-12-26 passes 28..31 December and 1 January, all closed by the
    // first rule and all before a 2027-only window; it stops on Monday 2027-01-04.
    it("lets a walk that starts before the window see the holidays it passes", () => {
      const rules: HolidayRule[] = [
        {
          name: "closed",
          kind: "dates",
          dates: [
            "2026-12-28",
            "2026-12-29",
            "2026-12-30",
            "2026-12-31",
            "2027-01-01",
          ],
        },
        {
          name: "a",
          kind: "fixed",
          month: 12,
          day: 26,
          observed: { 6: "nextWorkingDay" },
        },
      ];

      // 2027-12-26 is a Sunday and the policy leaves Sundays alone.
      expect(buildBusinessCalendar(spec(rules, 2027, 2027))?.holidays).toEqual([
        "2027-01-01",
        "2027-01-04",
        "2027-12-26",
      ]);
    });

    it("ignores dates rules outside the window", () => {
      const rule: HolidayRule = {
        name: "d",
        kind: "dates",
        dates: ["2024-05-01", "2025-12-31", "2026-06-01", "2027-01-01"],
      };

      expect(buildBusinessCalendar(spec([rule], 2026, 2026))?.holidays).toEqual(
        ["2026-06-01"],
      );
    });

    it("lists a date once when two different rules hit it", () => {
      const rules: HolidayRule[] = [
        { name: "a", kind: "nthWeekday", month: 1, weekday: 1, n: 3 },
        { name: "b", kind: "dates", dates: ["2026-01-19"] },
        { name: "c", kind: "fixed", month: 1, day: 19 },
      ];

      expect(buildBusinessCalendar(spec(rules, 2026, 2026))?.holidays).toEqual([
        "2026-01-19",
      ]);
    });
  });

  describe("the 31-day shift bound", () => {
    // Saturday 2026-12-26 shifted over the closed run 27 December .. `lastJanuaryDay` lands on
    // the next open weekday: 2026-12-26 + 31 days is Tuesday 2027-01-26, + 32 is Wednesday the 27th.
    const rules = (lastJanuaryDay: number): HolidayRule[] => [
      { name: "closed", kind: "dates", dates: closedRun(lastJanuaryDay) },
      {
        name: "a",
        kind: "fixed",
        month: 12,
        day: 26,
        observed: { 6: "nextWorkingDay" },
      },
    ];

    it("accepts a shift of exactly 31 days", () => {
      expect(
        buildBusinessCalendar(spec(rules(25), 2026, 2027))?.holidays,
      ).toEqual([...closedRun(25), "2027-01-26", "2027-12-26"]);
    });

    it("rejects a shift of 32 days", () => {
      expect(buildBusinessCalendar(spec(rules(26), 2026, 2027))).toBeNull();
    });
  });

  describe("other rule kinds and extremes", () => {
    it("expands a calendarFixed rule in every year of a multi-year build", () => {
      const rule: HolidayRule = {
        name: "h",
        kind: "calendarFixed",
        calendar: "hebrew",
        monthCode: "M01",
        day: 1,
      };

      // 1 Tishri 5787..5789
      expect(buildBusinessCalendar(spec([rule], 2026, 2028))?.holidays).toEqual(
        ["2026-09-12", "2027-10-02", "2028-09-21"],
      );
    });

    it("shifts over a weekend that is not Saturday and Sunday", () => {
      const rule: HolidayRule = {
        name: "a",
        kind: "fixed",
        month: 12,
        day: 25,
        observed: { 5: "nextWorkingDay" },
      };
      const calendar = buildBusinessCalendar(
        spec([rule], 2026, 2026, { weekend: [5, 6] }),
      );

      // Friday 2026-12-25; Friday and Saturday are the weekend, so the next open day is Sunday.
      expect(calendar).toEqual({
        weekend: [5, 6],
        holidays: ["2026-12-27"],
        timeZone: "UTC",
      });
    });

    it.each`
      label                    | date       | year       | holidays
      ${"year 0"}              | ${[1, 1]}  | ${0}       | ${["0000-01-01"]}
      ${"year -1"}             | ${[1, 1]}  | ${-1}      | ${["-000001-01-01"]}
      ${"last day in range"}   | ${[9, 13]} | ${275760}  | ${["+275760-09-13"]}
      ${"day after the range"} | ${[9, 14]} | ${275760}  | ${[]}
      ${"first day in range"}  | ${[4, 19]} | ${-271821} | ${["-271821-04-19"]}
      ${"day before range"}    | ${[4, 18]} | ${-271821} | ${[]}
    `(
      "expands a fixed rule at $label",
      ({
        date,
        year,
        holidays,
      }: {
        date: number[];
        year: number;
        holidays: string[];
      }) => {
        const rule: HolidayRule = {
          name: "x",
          kind: "fixed",
          month: date[0],
          day: date[1],
        };

        expect(
          buildBusinessCalendar(spec([rule], year, year))?.holidays,
        ).toEqual(holidays);
      },
    );
  });

  describe("agrees with the business-day functions", () => {
    const rules: HolidayRule[] = [
      { name: "c", kind: "easterRelative", offsetDays: -2 },
      { name: "d", kind: "easterRelative", offsetDays: 1 },
    ];
    const calendar = buildBusinessCalendar(spec(rules, 2026, 2026));

    // Thursday 2026-04-02; Good Friday 04-03, the weekend and Easter Monday 04-06 are closed.
    it("skips the built holidays when adding business days", () => {
      expect(addBusinessDays("2026-04-02", 1, calendar!)).toBe("2026-04-07");
    });

    it("skips them when adding days backwards", () => {
      expect(addBusinessDays("2026-04-07", -1, calendar!)).toBe("2026-04-02");
    });
  });

  describe("a year's holidays do not depend on the window", () => {
    const ALL_DAYS = {
      1: "nextWorkingDay",
      2: "nextWorkingDay",
      3: "nextWorkingDay",
      4: "nextWorkingDay",
      5: "nextWorkingDay",
      6: "nextWorkingDay",
      7: "nextWorkingDay",
    } as const;
    const isWeekday = (day: Temporal.PlainDate) => day.dayOfWeek <= 5;

    /**
     * A chain in which each later rule's walk starts just after the slot the earlier rule landed
     * on, so one extra holiday pushes every later walk about 31 days further: `dates` closes every
     * 2026 weekday except the slots, then each `fixed` rule with `nextWorkingDay` on every weekday
     * lands on the next slot.
     */
    function chain(): HolidayRule[] {
      const slots = [Temporal.PlainDate.from("2026-01-05")];
      const origins = [Temporal.PlainDate.from("2026-01-01")];

      while (Temporal.PlainDate.compare(slots.at(-1)!, "2027-01-01") < 0) {
        let candidate = origins.at(-1)!.add({ days: 31 });

        while (!isWeekday(candidate)) {
          candidate = candidate.subtract({ days: 1 });
        }

        origins.push(slots.at(-1)!.add({ days: 1 }));
        slots.push(candidate);
      }

      const open = new Set(slots.map(String));
      const closed: string[] = [];

      for (
        let day = Temporal.PlainDate.from("2026-01-01");
        day.year === 2026;
        day = day.add({ days: 1 })
      ) {
        if (isWeekday(day) && !open.has(String(day))) {
          closed.push(String(day));
        }
      }

      return [
        { name: "closed", kind: "dates", dates: closed },
        { name: "last", kind: "fixed", month: 12, day: 31, observed: ALL_DAYS },
        ...origins.slice(0, -1).map(
          (origin, index): HolidayRule => ({
            name: `walk ${index}`,
            kind: "fixed",
            month: origin.month,
            day: origin.day,
            observed: ALL_DAYS,
          }),
        ),
      ];
    }

    function inYear(
      rules: HolidayRule[],
      from: number,
      to: number,
      year: string,
    ) {
      const built = buildBusinessCalendar(spec(rules, from, to));

      return built?.holidays.filter((day) => day.startsWith(year));
    }

    it("gives 2027 the same holidays from a one-year and a longer window (24 calendar rules)", () => {
      const rules = chain();
      const wide = inYear(rules, 2020, 2027, "2027");

      expect(rules.length).toBeGreaterThanOrEqual(24);
      expect(wide).toBeDefined();
      expect(inYear(rules, 2027, 2027, "2027")).toEqual(wide);
      expect(inYear(rules, 2026, 2027, "2027")).toEqual(wide);
    });

    it("gives 2027 the same holidays from a one-year and a longer window (10 calendar rules)", () => {
      const rules: HolidayRule[] = [
        { name: "closed", kind: "dates", dates: ["2026-12-28", "2026-12-29"] },
        ...[20, 21, 22, 23, 24, 25, 26, 27, 28, 29].map(
          (day): HolidayRule => ({
            name: `walk ${day}`,
            kind: "fixed",
            month: 12,
            day,
            observed: ALL_DAYS,
          }),
        ),
      ];
      const wide = inYear(rules, 2020, 2027, "2027");

      expect(inYear(rules, 2027, 2027, "2027")).toEqual(wide);
    });
  });

  describe("shifts at Temporal's range limits", () => {
    it.each`
      label                                              | rule                                                                       | from       | to
      ${"a Saturday 275760-09-13 moved by next, margin"} | ${{ kind: "fixed", month: 9, day: 13, observed: { 6: { next: 1 } } }}      | ${275700}  | ${275759}
      ${"nextWorkingDay in the last margin year"}        | ${{ kind: "fixed", month: 9, day: 13, observed: { 6: "nextWorkingDay" } }} | ${275759}  | ${275759}
      ${"a Monday -271821-04-19 moved by previous"}      | ${{ kind: "fixed", month: 4, day: 19, observed: { 1: { previous: 2 } } }}  | ${-271820} | ${-271820}
    `(
      "$label gives one date per year",
      ({ rule, from, to }: { rule: object; from: number; to: number }) => {
        const built = buildBusinessCalendar(
          spec([{ name: "x", ...rule } as HolidayRule], from, to),
        );

        expect(built?.holidays).toHaveLength(to - from + 1);
      },
    );

    it.each`
      label                               | rule                                                                       | year
      ${"Saturday 275760-09-13, next"}    | ${{ kind: "fixed", month: 9, day: 13, observed: { 6: { next: 1 } } }}      | ${275760}
      ${"Saturday 275760-09-13, workday"} | ${{ kind: "fixed", month: 9, day: 13, observed: { 6: "nextWorkingDay" } }} | ${275760}
      ${"Monday -271821-04-19, previous"} | ${{ kind: "fixed", month: 4, day: 19, observed: { 1: { previous: 2 } } }}  | ${-271821}
    `(
      "$label inside the window is null",
      ({ rule, year }: { rule: object; year: number }) => {
        expect(
          buildBusinessCalendar(
            spec([{ name: "x", ...rule } as HolidayRule], year, year),
          ),
        ).toBeNull();
      },
    );

    // The margin years reach a calendar year a limit cuts, which keeps its dates inside the range.
    // The dates are `holidayDates`' range-edge rows, from Reingold & Dershowitz's arithmetic.
    it.each`
      calendar           | monthCode | day   | year       | expected
      ${"islamic-civil"} | ${"M01"}  | ${1}  | ${-271820} | ${["-271820-01-20"]}
      ${"persian"}       | ${"M01"}  | ${1}  | ${-271820} | ${["-271820-04-10"]}
      ${"ethiopic"}      | ${"M01"}  | ${1}  | ${-271820} | ${["-271820-01-27"]}
      ${"hebrew"}        | ${"M09"}  | ${15} | ${275759}  | ${["+275759-08-31"]}
    `(
      "calendarFixed $calendar $monthCode day $day in $year gives $expected",
      ({ calendar, monthCode, day, year, expected }) => {
        const rule: HolidayRule = {
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode,
          day,
        };

        expect(
          buildBusinessCalendar(spec([rule], year, year))?.holidays,
        ).toEqual(expected);
      },
    );

    it("fails a 45-day shift in the margin year before the window", () => {
      const march = Array.from({ length: 24 }, (_, i) =>
        `2026-03-${i + 8}`.replace(/-(\d)$/, "-0$1"),
      );
      const april = Array.from(
        { length: 20 },
        (_, i) => `2026-04-${String(i + 1).padStart(2, "0")}`,
      );
      const rules: HolidayRule[] = [
        { name: "closed", kind: "dates", dates: [...march, ...april] },
        {
          name: "a",
          kind: "fixed",
          month: 3,
          day: 7,
          observed: { 6: "nextWorkingDay" },
        },
      ];

      // Saturday 2026-03-07 would move 45 days, to Tuesday 2026-04-21.
      expect(buildBusinessCalendar(spec(rules, 2027, 2027))).toBeNull();
    });
  });

  it("returns an empty calendar for no rules", () => {
    expect(buildBusinessCalendar(spec([], 2026, 2026))).toEqual({
      weekend: [6, 7],
      holidays: [],
      timeZone: "UTC",
    });
  });

  it("sorts the weekend and drops repeats", () => {
    expect(
      buildBusinessCalendar(spec([], 2026, 2026, { weekend: [7, 6, 6] }))
        ?.weekend,
    ).toEqual([6, 7]);
  });

  it.each(["utc", "europe/berlin", "+01:00", "Asia/Calcutta"])(
    "hands back the non-canonical zone %s unchanged",
    (zone) => {
      expect(
        buildBusinessCalendar(spec([], 2026, 2026, { timeZone: zone }))
          ?.timeZone,
      ).toBe(zone);
    },
  );

  it.each(battleTestTimeZones)("hands back the zone %s unchanged", (zone) => {
    expect(
      buildBusinessCalendar(spec([], 2026, 2026, { timeZone: zone }))?.timeZone,
    ).toBe(zone);
  });

  describe("invalid input gives null", () => {
    const fixed: HolidayRule = { name: "a", kind: "fixed", month: 1, day: 1 };
    const valid = spec([fixed], 2026, 2026);

    it.each`
      label                     | input
      ${"null spec"}            | ${null}
      ${"array spec"}           | ${[]}
      ${"string spec"}          | ${"spec"}
      ${"hostile proxy"}        | ${hostileProxy()}
      ${"revoked proxy"}        | ${revokedProxy()}
      ${"unknown zone"}         | ${{ ...valid, timeZone: "Mars/Base" }}
      ${"numeric zone"}         | ${{ ...valid, timeZone: 1 }}
      ${"empty zone"}           | ${{ ...valid, timeZone: "" }}
      ${"zone with a space"}    | ${{ ...valid, timeZone: "UTC " }}
      ${"zone missing"}         | ${{ ...valid, timeZone: undefined }}
      ${"rule hostile proxy"}   | ${{ ...valid, rules: [hostileProxy()] }}
      ${"rules as an object"}   | ${{ ...valid, rules: { length: 0 } }}
      ${"fractional to"}        | ${{ ...valid, years: { from: 2026, to: 2026.5 } }}
      ${"to missing"}           | ${{ ...valid, years: { from: 2026 } }}
      ${"weekend [0]"}          | ${{ ...valid, weekend: [0] }}
      ${"all seven weekdays"}   | ${{ ...valid, weekend: [1, 2, 3, 4, 5, 6, 7] }}
      ${"weekend as a string"}  | ${{ ...valid, weekend: "6,7" }}
      ${"weekend missing"}      | ${{ ...valid, weekend: undefined }}
      ${"rules null"}           | ${{ ...valid, rules: null }}
      ${"rule without fields"}  | ${{ ...valid, rules: [{ kind: "fixed" }] }}
      ${"rule null"}            | ${{ ...valid, rules: [null] }}
      ${"years missing"}        | ${{ ...valid, years: undefined }}
      ${"years as an array"}    | ${{ ...valid, years: [2026, 2026] }}
      ${"from after to"}        | ${{ ...valid, years: { from: 2027, to: 2026 } }}
      ${"fractional from"}      | ${{ ...valid, years: { from: 2026.5, to: 2027 } }}
      ${"year above the range"} | ${{ ...valid, years: { from: 275761, to: 275761 } }}
      ${"year below the range"} | ${{ ...valid, years: { from: -271822, to: -271822 } }}
      ${"to above the range"}   | ${{ ...valid, years: { from: 275760, to: 275761 } }}
      ${"NaN from"}             | ${{ ...valid, years: { from: NaN, to: 2026 } }}
      ${"Infinity to"}          | ${{ ...valid, years: { from: 2026, to: Infinity } }}
      ${"string years"}         | ${{ ...valid, years: { from: "2026", to: "2026" } }}
      ${"1e306 to"}             | ${{ ...valid, years: { from: 2026, to: 1e306 } }}
      ${"-1e306 from"}          | ${{ ...valid, years: { from: -1e306, to: 2026 } }}
      ${"MAX_VALUE to"}         | ${{ ...valid, years: { from: 0, to: Number.MAX_VALUE } }}
      ${"-MAX_VALUE from"}      | ${{ ...valid, years: { from: -Number.MAX_VALUE, to: 0 } }}
      ${"both extremes"}        | ${{ ...valid, years: { from: -Number.MAX_VALUE, to: Number.MAX_VALUE } }}
    `("$label", ({ input }) => {
      expect(buildBusinessCalendar(input)).toBeNull();
    });

    it("reads each property of the spec once", () => {
      let reads = 0;
      const counted = {
        get timeZone() {
          reads += 1;
          return "UTC";
        },
        weekend: [6, 7],
        rules: [fixed],
        years: { from: 2026, to: 2026 },
      };

      expect(buildBusinessCalendar(counted)).not.toBeNull();
      expect(reads).toBe(1);
    });

    it("returns null when a property getter throws", () => {
      const throwing = {
        ...valid,
        get years(): never {
          throw new Error("boom");
        },
      };

      expect(buildBusinessCalendar(throwing)).toBeNull();
    });
  });
});
