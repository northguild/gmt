import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import type { FiscalCalendar } from "../../types";
import { getFiscalPeriod } from "./getFiscalPeriod";
import { getQuarter } from "./getQuarter";

/**
 * The NRF 4-5-4 retail calendar (US), with the 1.19 behaviour stated: a 53rd week is added "to
 * the end of the calendar" when "there are four or more days left in January", which is the
 * Saturday nearest January 31. 2026-01-31 is a Saturday falling exactly on January 31, so it
 * names both halves of the rule without drift. NRF labels a fiscal year by its start year.
 */
const nrf: FiscalCalendar = {
  pattern: "4-5-4",
  yearEndsOn: "2026-01-31",
  extraWeek: "lastPeriod",
  yearLabel: "startYear",
};

/** The two fields that reproduce 1.19 exactly, for the rows that state their own rule. */
const as119 = { extraWeek: "lastPeriod", yearLabel: "startYear" } as const;

describe("getFiscalPeriod", () => {
  it.each`
    value           | expected
    ${"2024-02-10"} | ${{ year: 2024, period: 1, week: 1 }}
    ${"2024-03-02"} | ${{ year: 2024, period: 1, week: 4 }}
    ${"2024-03-03"} | ${{ year: 2024, period: 2, week: 5 }}
    ${"2024-04-06"} | ${{ year: 2024, period: 2, week: 9 }}
    ${"2024-04-07"} | ${{ year: 2024, period: 3, week: 10 }}
    ${"2024-06-15"} | ${{ year: 2024, period: 5, week: 19 }}
    ${"2024-11-30"} | ${{ year: 2024, period: 10, week: 43 }}
    ${"2025-01-25"} | ${{ year: 2024, period: 12, week: 51 }}
    ${"2025-02-01"} | ${{ year: 2024, period: 12, week: 52 }}
  `(
    "returns $expected for $value in NRF fiscal 2024, a 52-week year",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, nrf)).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2018-01-28"} | ${{ year: 2017, period: 12, week: 53 }} | ${"the 53rd week of NRF fiscal 2017"}
    ${"2018-02-03"} | ${{ year: 2017, period: 12, week: 53 }} | ${"its last day"}
    ${"2018-02-04"} | ${{ year: 2018, period: 1, week: 1 }}   | ${"the first day after it"}
    ${"2029-01-28"} | ${{ year: 2028, period: 12, week: 53 }} | ${"the 53rd week of NRF fiscal 2028"}
    ${"2029-02-03"} | ${{ year: 2028, period: 12, week: 53 }} | ${"its last day"}
  `(
    "places the 53rd week at $expected for $value ($description)",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, nrf)).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2025-02-02"} | ${{ year: 2025, period: 1, week: 1 }}   | ${"NRF fiscal 2025 opens"}
    ${"2026-01-31"} | ${{ year: 2025, period: 12, week: 52 }} | ${"NRF fiscal 2025 closes, on the anchor date itself"}
    ${"2028-01-30"} | ${{ year: 2028, period: 1, week: 1 }}   | ${"NRF fiscal 2028 opens"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(getFiscalPeriod(value, nrf)).toEqual(expected);
  });

  it.each`
    value           | pattern    | expected
    ${"2024-03-03"} | ${"4-5-4"} | ${{ year: 2024, period: 2, week: 5 }}
    ${"2024-03-03"} | ${"4-4-5"} | ${{ year: 2024, period: 2, week: 5 }}
    ${"2024-03-03"} | ${"5-4-4"} | ${{ year: 2024, period: 1, week: 5 }}
    ${"2024-03-31"} | ${"4-5-4"} | ${{ year: 2024, period: 2, week: 9 }}
    ${"2024-03-31"} | ${"4-4-5"} | ${{ year: 2024, period: 3, week: 9 }}
    ${"2024-03-31"} | ${"5-4-4"} | ${{ year: 2024, period: 2, week: 9 }}
    ${"2024-04-07"} | ${"4-5-4"} | ${{ year: 2024, period: 3, week: 10 }}
    ${"2024-04-07"} | ${"4-4-5"} | ${{ year: 2024, period: 3, week: 10 }}
    ${"2024-04-07"} | ${"5-4-4"} | ${{ year: 2024, period: 3, week: 10 }}
  `(
    "puts week $expected.week of $value in period $expected.period under pattern $pattern",
    ({ value, pattern, expected }) => {
      expect(
        getFiscalPeriod(value, { pattern, yearEndsOn: "2026-01-31", ...as119 }),
      ).toEqual(expected);
    },
  );

  it.each`
    pattern    | expected
    ${"4-5-4"} | ${{ year: 2023, period: 12, week: 53 }}
    ${"4-4-5"} | ${{ year: 2023, period: 12, week: 53 }}
    ${"5-4-4"} | ${{ year: 2023, period: 12, week: 53 }}
  `(
    "appends the 53rd week to the final period under pattern $pattern",
    ({ pattern, expected }) => {
      expect(
        getFiscalPeriod("2024-01-28", {
          pattern,
          yearEndsOn: "2026-01-31",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2023-07-02"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"the first day of the year ending 2024-06-29"}
    ${"2024-06-29"} | ${{ year: 2023, period: 12, week: 52 }} | ${"its last day"}
    ${"2024-06-30"} | ${{ year: 2024, period: 1, week: 1 }}   | ${"the first day of the next one"}
    ${"2025-06-28"} | ${{ year: 2024, period: 12, week: 52 }} | ${"the last day of that one"}
  `(
    "handles a June-ending fiscal calendar: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-4-5",
          yearEndsOn: "2024-06-29",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    yearEndsOn      | expected                                | description
    ${"2026-01-31"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"the NRF rule, Saturdays nearest January 31"}
    ${"2024-02-03"} | ${{ year: 2022, period: 12, week: 52 }} | ${"a drifted 53-week year end, which states Saturdays nearest February 3 instead"}
  `(
    "reads yearEndsOn $yearEndsOn as a rule, not an instance: 2023-01-29 is $expected ($description)",
    ({ yearEndsOn, expected }) => {
      expect(
        getFiscalPeriod("2023-01-29", {
          pattern: "4-5-4",
          yearEndsOn,
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2022-01-01"} | ${{ year: 2021, period: 12, week: 52 }} | ${"a January date closing a year the rule ends on 2022-01-01"}
    ${"2022-01-02"} | ${{ year: 2022, period: 1, week: 1 }}   | ${"the next day, opening the following one"}
  `(
    "handles a December-ending rule whose year end lands in January: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-5-4",
          yearEndsOn: "2022-12-31",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2023-12-30"} | ${{ year: 2023, period: 12, week: 52 }} | ${"the last day of a year that both starts and ends in 2023"}
    ${"2023-12-31"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"the first day of the 53-week year that follows it — labelled 2023 as well, since it also starts in 2023"}
    ${"2025-01-04"} | ${{ year: 2023, period: 12, week: 53 }} | ${"that year's last day, a calendar year and a bit later"}
  `(
    "handles a January-ending rule whose year end lands in December: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-5-4",
          yearEndsOn: "2033-01-01",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2023-01-01"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"one fiscal year opens"}
    ${"2023-12-30"} | ${{ year: 2023, period: 12, week: 52 }} | ${"and closes, both inside 2023"}
    ${"2023-12-31"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"so the next one collides on the label — a documented limit of a rule anchored near 1 January"}
    ${"2024-12-29"} | ${{ year: 2023, period: 12, week: 53 }} | ${"and no fiscal year is labelled 2024 at all"}
    ${"2025-01-04"} | ${{ year: 2023, period: 12, week: 53 }} | ${"the second 2023 year closes in week 53, so 2023 labels 105 weeks"}
    ${"2019-01-05"} | ${{ year: 2017, period: 12, week: 53 }} | ${"the second 2017 year closes in 2019, so none is labelled 2018"}
    ${"2019-01-06"} | ${{ year: 2019, period: 1, week: 1 }}   | ${"the next opens as 2019"}
    ${"2030-01-05"} | ${{ year: 2028, period: 12, week: 53 }} | ${"the second 2028 year closes in 2030, so none is labelled 2029"}
    ${"2030-01-06"} | ${{ year: 2030, period: 1, week: 1 }}   | ${"the next opens as 2030"}
  `(
    "labels by the year a fiscal year starts in (startYear), collisions included: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-5-4",
          yearEndsOn: "2027-01-02",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  // "2022-12-31" states the Saturday nearest 31 December. Derived with Date.UTC: its years run
  // 2019-12-29..2021-01-02 (53 weeks), 2023-01-01..2023-12-30, 2023-12-31..2024-12-28,
  // 2024-12-29..2026-01-03 (53) and 2030-12-29..2032-01-03 (53), each labelled by its start
  // year — so 2023 labels two 52-week years and 2020, 2025 and 2031 label none.
  it.each`
    value           | expected                                | description
    ${"2020-06-15"} | ${{ year: 2019, period: 6, week: 25 }}  | ${"mid-2020 belongs to the year that started 2019-12-29"}
    ${"2021-01-02"} | ${{ year: 2019, period: 12, week: 53 }} | ${"which closes in 2021, so no year is labelled 2020"}
    ${"2021-01-03"} | ${{ year: 2021, period: 1, week: 1 }}   | ${"the next year opens as 2021"}
    ${"2023-12-30"} | ${{ year: 2023, period: 12, week: 52 }} | ${"one 2023 year closes"}
    ${"2023-12-31"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"and the next opens with the same label"}
    ${"2024-12-28"} | ${{ year: 2023, period: 12, week: 52 }} | ${"closing after 104 weeks labelled 2023"}
    ${"2026-01-03"} | ${{ year: 2024, period: 12, week: 53 }} | ${"the 2024 year closes in 2026, so no year is labelled 2025"}
    ${"2026-01-04"} | ${{ year: 2026, period: 1, week: 1 }}   | ${"the next year opens as 2026"}
    ${"2032-01-03"} | ${{ year: 2030, period: 12, week: 53 }} | ${"the 2030 year closes in 2032, so no year is labelled 2031"}
    ${"2032-01-04"} | ${{ year: 2032, period: 1, week: 1 }}   | ${"the next year opens as 2032"}
  `(
    "labels the Saturday-nearest-31-December rule by start year: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-5-4",
          yearEndsOn: "2022-12-31",
          ...as119,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value                    | expected
    ${"2024-02-04T00:00:00"} | ${{ year: 2024, period: 1, week: 1 }}
    ${"2024-02-03T23:59:59"} | ${{ year: 2023, period: 12, week: 53 }}
  `(
    "reads the date half of the zoneless datetime $value as $expected",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, nrf)).toEqual(expected);
    },
  );

  it.each`
    pattern      | description                                 | label
    ${"4-5-5"}   | ${"a pattern that is not one of the three"} | ${"'4-5-5'"}
    ${"454"}     | ${"a pattern missing its separators"}       | ${"'454'"}
    ${"4-5-4 "}  | ${"a pattern with trailing whitespace"}     | ${"'4-5-4 '"}
    ${""}        | ${"an empty pattern"}                       | ${"''"}
    ${undefined} | ${"no pattern"}                             | ${"undefined"}
    ${null}      | ${"a null pattern"}                         | ${"null"}
    ${454}       | ${"a non-string pattern"}                   | ${"454"}
  `("returns null when pattern is $label ($description)", ({ pattern }) => {
    expect(
      getFiscalPeriod("2024-06-15", {
        pattern,
        yearEndsOn: "2026-01-31",
        ...as119,
      } as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    yearEndsOn                                       | description                                                 | label
    ${"invalid"}                                     | ${"an unparseable string"}                                  | ${"'invalid'"}
    ${""}                                            | ${"an empty string"}                                        | ${"''"}
    ${"2026-02-30"}                                  | ${"a date that does not exist"}                             | ${"'2026-02-30'"}
    ${"2026-01-31T00:00:00"}                         | ${"a datetime rather than a date"}                          | ${"'2026-01-31T00:00:00'"}
    ${"2026-01-31T00:00:00Z"}                        | ${"an instant"}                                             | ${"'2026-01-31T00:00:00Z'"}
    ${"2026-01-31T00:00:00-05:00[America/New_York]"} | ${"a zoned datetime"}                                       | ${"'2026-01-31T00:00:00-05:00[America/New_York]'"}
    ${"2026-01-31[u-ca=hebrew]"}                     | ${"a non-ISO calendar, whose year and month are not ISO's"} | ${"'2026-01-31[u-ca=hebrew]'"}
    ${undefined}                                     | ${"absent"}                                                 | ${"undefined"}
    ${null}                                          | ${"null"}                                                   | ${"null"}
    ${20260131}                                      | ${"a number"}                                               | ${"20260131"}
  `(
    "returns null when yearEndsOn is $label ($description)",
    ({ yearEndsOn }) => {
      expect(
        getFiscalPeriod("2024-06-15", {
          pattern: "4-5-4",
          yearEndsOn,
          ...as119,
        } as unknown as FiscalCalendar),
      ).toBeNull();
    },
  );

  it.each`
    calendar                  | description
    ${undefined}              | ${"no calendar"}
    ${null}                   | ${"a null calendar"}
    ${{}}                     | ${"an empty calendar"}
    ${"4-5-4"}                | ${"a string instead of a calendar"}
    ${[]}                     | ${"an empty array"}
    ${[nrf]}                  | ${"an array holding the NRF calendar"}
    ${Object.assign([], nrf)} | ${"an array with the four NRF fields set on it"}
  `("returns null when the calendar is $description", ({ calendar }) => {
    expect(
      getFiscalPeriod("2024-06-15", calendar as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00"}                   | ${"an offset datetime"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
    ${"invalid"}                                     | ${"an unparseable string"}
    ${""}                                            | ${"an empty string"}
    ${"2024-02-30"}                                  | ${"a date that does not exist"}
    ${"2024-12-31T23:59:60"}                         | ${"a leap second"}
    ${"2024-06-15[u-ca=hebrew]"}                     | ${"a date in a non-ISO calendar"}
  `("returns null when '$value' is $description", ({ value }) => {
    expect(getFiscalPeriod(value, nrf)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(getFiscalPeriod(value as unknown as string, nrf)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getFiscalPeriod("2024-06-15", nrf)).toBeNull();
  });

  // The pre-built mock fails the first call, the parse of `yearEndsOn` inside validation. These
  // fail the later call sites instead, each of which the function reaches on the NRF input:
  // `with` and `add` place the year ends, `until` counts the weeks.
  it.each`
    method
    ${"with"}
    ${"add"}
    ${"until"}
  `(
    "returns null when Temporal.PlainDate.prototype.$method throws",
    ({ method }: { method: "with" | "add" | "until" }) => {
      vi.spyOn(Temporal.PlainDate.prototype, method).mockImplementation(() => {
        throw new RangeError("simulated failure");
      });

      expect(getFiscalPeriod("2024-06-15", nrf)).toBeNull();
    },
  );

  // majorityYear builds 1 January of the middle year of a fiscal year that spans three
  // calendar years: ONS (UK) 2025, 2024-12-29 to 2026-01-03.
  it("returns null when Temporal.PlainDate.from throws on the majorityYear property bag", () => {
    const from = Temporal.PlainDate.from;
    vi.spyOn(Temporal.PlainDate, "from").mockImplementation((item, options) => {
      if (typeof item !== "string") throw new RangeError("simulated failure");
      return from.call(Temporal.PlainDate, item, options);
    });

    expect(
      getFiscalPeriod("2024-12-29", {
        pattern: "4-4-5",
        yearEndsOn: "2022-12-31",
        extraWeek: "firstPeriod",
        yearLabel: "majorityYear",
      }),
    ).toBeNull();
  });

  // A function is an ECMAScript Object (ECMA-262 §6.1.7), and the calendar is read
  // with `isObject`, so its four fields are read like a plain object's.
  it("reads a function carrying the four NRF fields as the NRF calendar", () => {
    expect(
      getFiscalPeriod(
        "2024-06-15",
        Object.assign(() => 0, nrf),
      ),
    ).toEqual({ year: 2024, period: 5, week: 19 });
  });

  // `[u-ca=iso8601]` names the ISO calendar, so the rule is NRF's (RFC 9557 §3.3).
  it("reads yearEndsOn 2026-01-31[u-ca=iso8601] as the NRF rule", () => {
    expect(
      getFiscalPeriod("2024-06-15", {
        ...nrf,
        yearEndsOn: "2026-01-31[u-ca=iso8601]",
      }),
    ).toEqual({ year: 2024, period: 5, week: 19 });
  });
});

/** ONS retail trading periods (UK): Saturday nearest 31 December, a five-week January. */
const ONS: FiscalCalendar = {
  pattern: "4-4-5",
  yearEndsOn: "2022-12-31",
  extraWeek: "firstPeriod",
  yearLabel: "majorityYear",
};

/**
 * A mid-year calendar: the Sunday nearest 27 June, the extra week in the last period, and the
 * year named by the date it ends (IFRS 18 ¶27(c), formerly IAS 1 ¶51(c)).
 */
const JUNE_END_YEAR: FiscalCalendar = {
  pattern: "4-4-5",
  yearEndsOn: "2021-06-27",
  extraWeek: "lastPeriod",
  yearLabel: "endYear",
};

/**
 * A calendar with a tie year: the Wednesday nearest 1 July. Its year 2025-07-03 to 2026-07-01
 * has 182 days in 2025 and 182 in 2026.
 */
const T: FiscalCalendar = {
  pattern: "4-4-5",
  yearEndsOn: "2026-07-01",
  extraWeek: "lastPeriod",
  yearLabel: "majorityYear",
};

describe("getFiscalPeriod reproduces published calendars", () => {
  // NRF 4-5-4 calendar (US): FAQ week 1 of 2017 opens January 29; the 2023–2025 PDF gives
  // fiscal 2023 53 weeks with week 53 = 2024-01-28 to 2024-02-03.
  it.each`
    value           | expected                                | published
    ${"2017-01-29"} | ${{ year: 2017, period: 1, week: 1 }}   | ${"2017 week 1 opens January 29"}
    ${"2023-01-29"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"fiscal 2023 opens"}
    ${"2024-01-27"} | ${{ year: 2023, period: 12, week: 52 }} | ${"the last day of week 52"}
    ${"2024-01-28"} | ${{ year: 2023, period: 12, week: 53 }} | ${"week 53 opens, in January (period 12)"}
    ${"2024-02-03"} | ${{ year: 2023, period: 12, week: 53 }} | ${"week 53 closes"}
    ${"2024-02-04"} | ${{ year: 2024, period: 1, week: 1 }}   | ${"fiscal 2024 opens"}
  `("NRF (US): $value is $expected ($published)", ({ value, expected }) => {
    expect(getFiscalPeriod(value, nrf)).toEqual(expected);
  });

  // ONS tradingperiods2026.xlsx, sheet "Trading Periods for 2025": January 2024-12-29 to
  // 2025-02-01 (5 weeks), February 2025-02-02 to 2025-03-01, March 2025-03-02 to 2025-04-05
  // (5 weeks), December ends 2026-01-03; the 2026 sheet opens 2026-01-04.
  it.each`
    value           | expected                                | published
    ${"2024-12-29"} | ${{ year: 2025, period: 1, week: 1 }}   | ${"2025 opens in 2024 and is labelled 2025"}
    ${"2025-02-01"} | ${{ year: 2025, period: 1, week: 5 }}   | ${"the five-week January ends"}
    ${"2025-02-02"} | ${{ year: 2025, period: 2, week: 6 }}   | ${"February opens"}
    ${"2025-03-01"} | ${{ year: 2025, period: 2, week: 9 }}   | ${"February ends after 4 weeks"}
    ${"2025-03-02"} | ${{ year: 2025, period: 3, week: 10 }}  | ${"March opens"}
    ${"2025-04-05"} | ${{ year: 2025, period: 3, week: 14 }}  | ${"March ends after 5 weeks, so Q1 is 14 weeks"}
    ${"2026-01-03"} | ${{ year: 2025, period: 12, week: 53 }} | ${"2025 ends in 2026 and is still labelled 2025"}
    ${"2026-01-04"} | ${{ year: 2026, period: 1, week: 1 }}   | ${"2026 opens"}
  `("ONS (UK): $value is $expected ($published)", ({ value, expected }) => {
    expect(getFiscalPeriod(value, ONS)).toEqual(expected);
  });

  // The same ONS workbook, sheets "Trading Periods for 2014", "2020", "2023" and "2024":
  // 2014 runs 2013-12-29 to 2015-01-03 (53 weeks, 5-week January); 2020 runs 2019-12-29 to
  // 2021-01-02 with January ending 2020-02-01; 2023 runs 2023-01-01 to 2023-12-30, inside one
  // calendar year; 2024 runs 2023-12-31 to 2024-12-28, so 1 of its 364 days is in 2023.
  it.each`
    value           | expected                                | published
    ${"2013-12-29"} | ${{ year: 2014, period: 1, week: 1 }}   | ${"2014 opens in 2013 and is labelled 2014"}
    ${"2015-01-03"} | ${{ year: 2014, period: 12, week: 53 }} | ${"2014 ends in 2015, a 3-calendar-year span"}
    ${"2020-02-01"} | ${{ year: 2020, period: 1, week: 5 }}   | ${"the 2020 five-week January ends"}
    ${"2023-12-30"} | ${{ year: 2023, period: 12, week: 52 }} | ${"2023 ends, inside one calendar year"}
    ${"2023-12-31"} | ${{ year: 2024, period: 1, week: 1 }}   | ${"2024 opens on 31 December 2023 and is labelled 2024"}
    ${"2024-12-28"} | ${{ year: 2024, period: 12, week: 52 }} | ${"2024 ends, 52 weeks"}
  `(
    "ONS (UK), more published years: $value is $expected ($published)",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, ONS)).toEqual(expected);
    },
  );
});

describe("getFiscalPeriod extraWeek", () => {
  // NRF fiscal 2023 (2023-01-29 to 2024-02-03) has 53 weeks. Under "firstPeriod" its first
  // quarter is 5-5-4; under "lastPeriod" it is 4-5-4 and the last quarter is 4-5-5.
  it.each`
    value           | extraWeek        | expected                                | description
    ${"2023-02-25"} | ${"firstPeriod"} | ${{ year: 2023, period: 1, week: 4 }}   | ${"day 28 of the year"}
    ${"2023-02-26"} | ${"firstPeriod"} | ${{ year: 2023, period: 1, week: 5 }}   | ${"period 1 is 5 weeks"}
    ${"2023-03-04"} | ${"firstPeriod"} | ${{ year: 2023, period: 1, week: 5 }}   | ${"the last day of week 5"}
    ${"2023-03-05"} | ${"firstPeriod"} | ${{ year: 2023, period: 2, week: 6 }}   | ${"period 2 opens a week later"}
    ${"2023-02-26"} | ${"lastPeriod"}  | ${{ year: 2023, period: 2, week: 5 }}   | ${"the same week, in period 2"}
    ${"2024-01-28"} | ${"firstPeriod"} | ${{ year: 2023, period: 12, week: 53 }} | ${"week 53 is in period 12 either way"}
    ${"2024-01-28"} | ${"lastPeriod"}  | ${{ year: 2023, period: 12, week: 53 }} | ${"week 53 is in the lengthened period 12"}
    ${"2024-06-15"} | ${"firstPeriod"} | ${{ year: 2024, period: 5, week: 19 }}  | ${"no effect in a 52-week year"}
    ${"2024-06-15"} | ${"lastPeriod"}  | ${{ year: 2024, period: 5, week: 19 }}  | ${"the same"}
  `(
    "NRF with extraWeek $extraWeek puts $value at $expected ($description)",
    ({ value, extraWeek, expected }) => {
      expect(getFiscalPeriod(value, { ...nrf, extraWeek })).toEqual(expected);
    },
  );

  // The ONS calendar with the week moved to the end: its January is 4 weeks, so week 5 is in
  // February, and week 53 lengthens December. The year 2019-12-29 to 2021-01-02 has 53 weeks:
  // periods 1 to 11 run 4-4-5, so period 9 ends with week 39, and period 12 is weeks 48 to 53.
  it.each`
    value           | expected                                | description
    ${"2025-02-01"} | ${{ year: 2025, period: 2, week: 5 }}   | ${"ONS week 5 moves to February"}
    ${"2026-01-03"} | ${{ year: 2025, period: 12, week: 53 }} | ${"week 53 in period 12"}
    ${"2019-12-28"} | ${{ year: 2019, period: 12, week: 52 }} | ${"2019 ends after 52 weeks"}
    ${"2019-12-29"} | ${{ year: 2020, period: 1, week: 1 }}   | ${"2020 opens in 2019 and is labelled 2020"}
    ${"2020-09-26"} | ${{ year: 2020, period: 9, week: 39 }}  | ${"the third quarter ends"}
    ${"2020-09-27"} | ${{ year: 2020, period: 10, week: 40 }} | ${"the fourth quarter opens: weeks 40 to 53 are 14 weeks"}
    ${"2021-01-02"} | ${{ year: 2020, period: 12, week: 53 }} | ${"2020 ends on 2 January 2021"}
    ${"2021-01-03"} | ${{ year: 2021, period: 1, week: 1 }}   | ${"2021 opens"}
  `(
    "ONS with extraWeek lastPeriod puts $value at $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, { ...ONS, extraWeek: "lastPeriod" }),
      ).toEqual(expected);
    },
  );
});

describe("getFiscalPeriod yearLabel", () => {
  it.each`
    value           | calendar         | yearLabel         | year    | description
    ${"2024-06-15"} | ${nrf}           | ${"endYear"}      | ${2025} | ${"NRF 2024-02-04 to 2025-02-01 ends in 2025"}
    ${"2024-06-15"} | ${nrf}           | ${"majorityYear"} | ${2024} | ${"332 days in 2024, 32 in 2025"}
    ${"2024-01-28"} | ${nrf}           | ${"endYear"}      | ${2024} | ${"NRF 2023-01-29 to 2024-02-03 ends in 2024"}
    ${"2024-01-28"} | ${nrf}           | ${"majorityYear"} | ${2023} | ${"337 days in 2023, 34 in 2024"}
    ${"2024-12-29"} | ${ONS}           | ${"startYear"}    | ${2024} | ${"ONS 2025 starts in 2024"}
    ${"2024-12-29"} | ${ONS}           | ${"endYear"}      | ${2026} | ${"and ends in 2026: neither end year matches ONS"}
    ${"2024-12-29"} | ${ONS}           | ${"majorityYear"} | ${2025} | ${"365 of its 371 days are in 2025"}
    ${"2024-06-30"} | ${JUNE_END_YEAR} | ${"majorityYear"} | ${2023} | ${"189 days in 2023, 182 in 2024"}
    ${"2024-06-30"} | ${JUNE_END_YEAR} | ${"startYear"}    | ${2023} | ${"2023-06-26 to 2024-06-30 starts in 2023"}
    ${"2024-06-30"} | ${JUNE_END_YEAR} | ${"endYear"}      | ${2024} | ${"and ends in 2024"}
  `(
    "labels $value as $year under $yearLabel ($description)",
    ({ value, calendar, yearLabel, year }) => {
      expect(getFiscalPeriod(value, { ...calendar, yearLabel })).toEqual(
        expect.objectContaining({ year }),
      );
    },
  );

  // JUNE_END_YEAR, the Sunday nearest 27 June: 2022-06-27 to 2023-06-25 (52 weeks),
  // 2023-06-26 to 2024-06-30 (53 weeks) and 2024-07-01 to 2025-06-29 (52 weeks). Each is named
  // by the year it ends in, so a year that opens in June is labelled one year on.
  it.each`
    value           | expected                                | description
    ${"2023-06-25"} | ${{ year: 2023, period: 12, week: 52 }} | ${"2023 ends on 25 June 2023, 52 weeks"}
    ${"2023-06-26"} | ${{ year: 2024, period: 1, week: 1 }}   | ${"2024 opens in 2023, labelled by its end year"}
    ${"2024-06-30"} | ${{ year: 2024, period: 12, week: 53 }} | ${"2024 ends on 30 June 2024, 53 weeks"}
    ${"2024-07-01"} | ${{ year: 2025, period: 1, week: 1 }}   | ${"2025 opens"}
    ${"2025-06-29"} | ${{ year: 2025, period: 12, week: 52 }} | ${"2025 ends on 29 June 2025, 52 weeks"}
  `(
    "labels a June year end by its end year: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, JUNE_END_YEAR)).toEqual(expected);
    },
  );

  // GMT rule: a 182/182 split goes to the end year, because IFRS 18 ¶27(c) (formerly IAS 1
  // ¶51(c)) lets a reporting period be identified by the date it ends.
  it.each`
    value           | yearLabel         | expected
    ${"2025-07-03"} | ${"majorityYear"} | ${{ year: 2026, period: 1, week: 1 }}
    ${"2026-07-01"} | ${"majorityYear"} | ${{ year: 2026, period: 12, week: 52 }}
    ${"2026-07-01"} | ${"startYear"}    | ${{ year: 2025, period: 12, week: 52 }}
    ${"2026-07-01"} | ${"endYear"}      | ${{ year: 2026, period: 12, week: 52 }}
  `(
    "sends the tie year 2025-07-03 to 2026-07-01 to $expected.year under $yearLabel: $value is $expected",
    ({ value, yearLabel, expected }) => {
      expect(getFiscalPeriod(value, { ...T, yearLabel })).toEqual(expected);
    },
  );

  // The JSDoc bullet "year is not a unique key for every year end": under "2026-07-01" with
  // majorityYear, 2025-07-03 to 2026-07-01 and 2026-07-02 to 2027-06-30 are both 2026.
  it.each`
    value           | expected                                | fiscalYear
    ${"2025-07-02"} | ${{ year: 2025, period: 12, week: 52 }} | ${"2024-07-04 to 2025-07-02 (181 days in 2024, 183 in 2025)"}
    ${"2026-07-01"} | ${{ year: 2026, period: 12, week: 52 }} | ${"2025-07-03 to 2026-07-01 (182 and 182, a tie)"}
    ${"2026-07-02"} | ${{ year: 2026, period: 1, week: 1 }}   | ${"2026-07-02 to 2027-06-30 (183 days in 2026, 181 in 2027)"}
  `(
    "year is not a unique key for every year end: $value is $expected, in $fiscalYear",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, T)).toEqual(expected);
    },
  );

  // The tie year's neighbours under the other two labels: near 1 July the start and end years
  // step by one, so neither repeats there.
  it.each`
    value           | yearLabel      | expected                                | fiscalYear
    ${"2025-07-02"} | ${"startYear"} | ${{ year: 2024, period: 12, week: 52 }} | ${"2024-07-04 to 2025-07-02"}
    ${"2025-07-03"} | ${"startYear"} | ${{ year: 2025, period: 1, week: 1 }}   | ${"2025-07-03 to 2026-07-01, the tie year"}
    ${"2026-07-02"} | ${"startYear"} | ${{ year: 2026, period: 1, week: 1 }}   | ${"2026-07-02 to 2027-06-30"}
    ${"2025-07-02"} | ${"endYear"}   | ${{ year: 2025, period: 12, week: 52 }} | ${"2024-07-04 to 2025-07-02"}
    ${"2025-07-03"} | ${"endYear"}   | ${{ year: 2026, period: 1, week: 1 }}   | ${"2025-07-03 to 2026-07-01, the tie year"}
    ${"2026-07-02"} | ${"endYear"}   | ${{ year: 2027, period: 1, week: 1 }}   | ${"2026-07-02 to 2027-06-30"}
  `(
    "labels $value as $expected.year under $yearLabel, in $fiscalYear",
    ({ value, yearLabel, expected }) => {
      expect(getFiscalPeriod(value, { ...T, yearLabel })).toEqual(expected);
    },
  );

  // The JSDoc bullet "year is not a unique key for every year end" for endYear, near 1 January.
  // ONS (UK) year bounds from tradingperiods2026.xlsx: 2021-01-03 to 2022-01-01 and 2022-01-02
  // to 2022-12-31 both end in 2022; 2023-12-31 to 2024-12-28 ends in 2024 and 2024-12-29 to
  // 2026-01-03 in 2026, so no fiscal year is labelled 2025.
  it.each`
    value           | expected                                | fiscalYear
    ${"2022-01-01"} | ${{ year: 2022, period: 12, week: 52 }} | ${"2021-01-03 to 2022-01-01"}
    ${"2022-01-02"} | ${{ year: 2022, period: 1, week: 1 }}   | ${"2022-01-02 to 2022-12-31, the same label"}
    ${"2024-12-28"} | ${{ year: 2024, period: 12, week: 52 }} | ${"2023-12-31 to 2024-12-28"}
    ${"2026-01-03"} | ${{ year: 2026, period: 12, week: 53 }} | ${"2024-12-29 to 2026-01-03, skipping 2025"}
  `(
    "year is not a unique key under endYear either: $value is $expected, in $fiscalYear",
    ({ value, expected }) => {
      expect(getFiscalPeriod(value, { ...ONS, yearLabel: "endYear" })).toEqual(
        expected,
      );
    },
  );

  // ONS (UK) 2023 runs 2023-01-01 to 2023-12-30, so all three rules name the same year.
  it.each`
    yearLabel
    ${"startYear"}
    ${"endYear"}
    ${"majorityYear"}
  `(
    "labels a fiscal year inside one calendar year as 2023 under $yearLabel",
    ({ yearLabel }) => {
      expect(getFiscalPeriod("2023-12-30", { ...ONS, yearLabel })).toEqual({
        year: 2023,
        period: 12,
        week: 52,
      });
    },
  );
});

// Temporal's range is -271821-04-19 to +275760-09-13. The Gregorian calendar repeats every
// 400 years (146,097 days, a whole number of weeks), so each expected value is the value for
// the same rule a whole number of cycles inside the range, re-derived with plain
// `@js-temporal/polyfill` date arithmetic and moved back by those cycles.
describe("getFiscalPeriod at Temporal's range limits", () => {
  it.each`
    value              | calendar         | expected                                  | fiscalYear
    ${"-271820-06-01"} | ${nrf}           | ${{ year: -271820, period: 5, week: 18 }} | ${"-271820-01-30 to -271819-02-03 (as 2180-01-30 to 2181-02-03, 685 cycles on)"}
    ${"-271821-12-15"} | ${JUNE_END_YEAR} | ${{ year: -271820, period: 6, week: 25 }} | ${"-271821-06-28 to -271820-06-25 (as 2179-06-28 to 2180-06-25)"}
    ${"-271820-01-15"} | ${ONS}           | ${{ year: -271820, period: 1, week: 2 }}  | ${"-271820-01-02 to -271820-12-30 (as 2180-01-02 to 2180-12-30)"}
    ${"+275759-12-15"} | ${ONS}           | ${{ year: 275759, period: 12, week: 50 }} | ${"+275758-12-31 to +275759-12-29 (as 2158-12-31 to 2159-12-29, 684 cycles back)"}
    ${"+275760-01-15"} | ${nrf}           | ${{ year: 275759, period: 12, week: 50 }} | ${"+275759-02-04 to +275760-02-02 (as 2159-02-04 to 2160-02-02)"}
    ${"+275760-06-01"} | ${JUNE_END_YEAR} | ${{ year: 275760, period: 12, week: 49 }} | ${"+275759-06-25 to +275760-06-29, 53 weeks (as 2159-06-25 to 2160-06-29)"}
  `(
    "returns $expected for $value, whose fiscal year $fiscalYear lies inside the range",
    ({ value, calendar, expected }) => {
      expect(getFiscalPeriod(value, calendar)).toEqual(expected);
    },
  );

  // A fiscal year can open on the first date or close on the last one while the year end next
  // to it, or the month-day the rule targets, lies outside the range. -271821-04-19 is a
  // Monday and +275760-09-13 a Saturday (the Instant range is 10^8 days either side of
  // 1970-01-01, a Thursday, and PlainDate reaches one day further back).
  it.each`
    value              | yearEndsOn      | yearLabel      | expected                                  | fiscalYear
    ${"-271821-04-19"} | ${"2021-04-18"} | ${"startYear"} | ${{ year: -271821, period: 1, week: 1 }}  | ${"-271821-04-19 to -271820-04-16 opens on the first date; the year end before it is -271821-04-18"}
    ${"-271821-04-20"} | ${"2023-04-17"} | ${"startYear"} | ${{ year: -271821, period: 1, week: 1 }}  | ${"-271821-04-20 to -271820-04-17 follows the year end -271821-04-19, whose target -271821-04-17 is before the range"}
    ${"+275760-09-13"} | ${"2018-09-15"} | ${"endYear"}   | ${{ year: 275760, period: 12, week: 52 }} | ${"+275759-09-16 to +275760-09-13 closes on the last date, two days before its target +275760-09-15"}
  `(
    "returns $expected for $value with yearEndsOn $yearEndsOn: $fiscalYear",
    ({ value, yearEndsOn, yearLabel, expected }) => {
      const calendar: FiscalCalendar = {
        pattern: "4-4-5",
        yearEndsOn,
        extraWeek: "lastPeriod",
        yearLabel,
      };

      expect(getFiscalPeriod(value, calendar)).toEqual(expected);
    },
  );

  // A fiscal year can run past the first or last date and still have a year, period and week:
  // all three are calendar arithmetic, and no date of the fiscal year is returned. Each value
  // is worked in the year 685 cycles on (-271821 as 2179) or 684 back (+275760 as 2160), and
  // only the year is moved back.
  it.each`
    value              | calendar         | name               | expected                                   | fiscalYear
    ${"-271821-04-19"} | ${nrf}           | ${"NRF"}           | ${{ year: -271821, period: 3, week: 12 }}  | ${"opens -271821-01-31, before the first date (as 2179-01-31 to 2180-01-29; day 79)"}
    ${"+275760-09-13"} | ${nrf}           | ${"NRF"}           | ${{ year: 275760, period: 8, week: 32 }}   | ${"closes +275761-01-31, after the last date (as 2160-02-03 to 2161-01-31; day 224)"}
    ${"-271821-04-19"} | ${JUNE_END_YEAR} | ${"JUNE_END_YEAR"} | ${{ year: -271821, period: 10, week: 43 }} | ${"opens -271822-06-29, before the first date (as 2178-06-29 to 2179-06-27; day 295)"}
    ${"+275760-09-13"} | ${JUNE_END_YEAR} | ${"JUNE_END_YEAR"} | ${{ year: 275761, period: 3, week: 11 }}   | ${"closes +275761-06-28, after the last date (as 2160-06-30 to 2161-06-28; day 77)"}
    ${"-271821-04-19"} | ${ONS}           | ${"ONS"}           | ${{ year: -271821, period: 4, week: 16 }}  | ${"opens -271821-01-03, before the first date (as 2179-01-03 to 2180-01-01; 363 days in 2179)"}
    ${"+275760-09-13"} | ${ONS}           | ${"ONS"}           | ${{ year: 275760, period: 9, week: 37 }}   | ${"closes +275761-01-03, after the last date (as 2159-12-30 to 2161-01-03; 366 days in 2160)"}
  `(
    "returns $expected for $value under $name, whose fiscal year $fiscalYear",
    ({ value, calendar, expected }) => {
      expect(getFiscalPeriod(value, calendar)).toEqual(expected);
    },
  );

  it("returns week 52 for -271821-04-19 when it closes a fiscal year opening -271822-04-21, before the first date", () => {
    // As 2178-04-21 to 2179-04-19: 364 days, so the last day is week 52 of period 12.
    expect(
      getFiscalPeriod("-271821-04-19", {
        pattern: "4-4-5",
        yearEndsOn: "2023-04-17",
        extraWeek: "lastPeriod",
        yearLabel: "startYear",
      }),
    ).toEqual({ year: -271822, period: 12, week: 52 });
  });

  // Every extraWeek and yearLabel at both ends, on a 53-week year that runs past the range.
  // "The Wednesday nearest 20 March" (2024-03-20): -271821-03-18 to -271820-03-22, as
  // 2179-03-18 to 2180-03-22, 371 days with 2180-02-29. -271821-04-19 is day 33, week 5:
  // period 1 when it is five weeks long, period 2 when it is four. 289 days fall in -271821.
  // "The Monday nearest 17 April" (2023-04-17): +275760-04-15 to +275761-04-20, as 2160-04-15
  // to 2161-04-20, 371 days. +275760-09-13 is day 152, week 22: periods run 5-4-5-4-4 to week
  // 22 under firstPeriod, and 4-4-5-4-4 to week 21 under lastPeriod. 261 days fall in 275760.
  it.each`
    value              | yearEndsOn      | extraWeek        | yearLabel         | expected
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"firstPeriod"} | ${"startYear"}    | ${{ year: -271821, period: 1, week: 5 }}
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"firstPeriod"} | ${"endYear"}      | ${{ year: -271820, period: 1, week: 5 }}
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"firstPeriod"} | ${"majorityYear"} | ${{ year: -271821, period: 1, week: 5 }}
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"lastPeriod"}  | ${"startYear"}    | ${{ year: -271821, period: 2, week: 5 }}
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"lastPeriod"}  | ${"endYear"}      | ${{ year: -271820, period: 2, week: 5 }}
    ${"-271821-04-19"} | ${"2024-03-20"} | ${"lastPeriod"}  | ${"majorityYear"} | ${{ year: -271821, period: 2, week: 5 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"firstPeriod"} | ${"startYear"}    | ${{ year: 275760, period: 5, week: 22 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"firstPeriod"} | ${"endYear"}      | ${{ year: 275761, period: 5, week: 22 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"firstPeriod"} | ${"majorityYear"} | ${{ year: 275760, period: 5, week: 22 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"lastPeriod"}  | ${"startYear"}    | ${{ year: 275760, period: 6, week: 22 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"lastPeriod"}  | ${"endYear"}      | ${{ year: 275761, period: 6, week: 22 }}
    ${"+275760-09-13"} | ${"2023-04-17"} | ${"lastPeriod"}  | ${"majorityYear"} | ${{ year: 275760, period: 6, week: 22 }}
  `(
    "returns $expected for $value with yearEndsOn $yearEndsOn, $extraWeek and $yearLabel, a 53-week year past the range",
    ({ value, yearEndsOn, extraWeek, yearLabel, expected }) => {
      expect(
        getFiscalPeriod(value, {
          pattern: "4-4-5",
          yearEndsOn,
          extraWeek,
          yearLabel,
        }),
      ).toEqual(expected);
    },
  );

  // getQuarter labels a fiscal year that starts on day 1 of a month. Its February year matches
  // NRF's (opening near 1 February) and its July year matches JUNE_END_YEAR's (opening near
  // 1 July) at both ends: each pair starts in the same calendar year, ends in the same one, and
  // puts most of its days in the same one. So the two functions name each year alike under
  // every label.
  it.each`
    value              | calendar         | fiscalYearStartMonth | yearLabel         | year
    ${"-271821-04-19"} | ${nrf}           | ${2}                 | ${"startYear"}    | ${-271821}
    ${"-271821-04-19"} | ${nrf}           | ${2}                 | ${"endYear"}      | ${-271820}
    ${"-271821-04-19"} | ${nrf}           | ${2}                 | ${"majorityYear"} | ${-271821}
    ${"-271821-04-19"} | ${JUNE_END_YEAR} | ${7}                 | ${"startYear"}    | ${-271822}
    ${"-271821-04-19"} | ${JUNE_END_YEAR} | ${7}                 | ${"endYear"}      | ${-271821}
    ${"-271821-04-19"} | ${JUNE_END_YEAR} | ${7}                 | ${"majorityYear"} | ${-271822}
    ${"+275760-09-13"} | ${nrf}           | ${2}                 | ${"startYear"}    | ${275760}
    ${"+275760-09-13"} | ${nrf}           | ${2}                 | ${"endYear"}      | ${275761}
    ${"+275760-09-13"} | ${nrf}           | ${2}                 | ${"majorityYear"} | ${275760}
    ${"+275760-09-13"} | ${JUNE_END_YEAR} | ${7}                 | ${"startYear"}    | ${275760}
    ${"+275760-09-13"} | ${JUNE_END_YEAR} | ${7}                 | ${"endYear"}      | ${275761}
    ${"+275760-09-13"} | ${JUNE_END_YEAR} | ${7}                 | ${"majorityYear"} | ${275760}
  `(
    "names the year of $value as $year under $yearLabel, as getQuarter does with fiscalYearStartMonth $fiscalYearStartMonth",
    ({ value, calendar, fiscalYearStartMonth, yearLabel, year }) => {
      expect(getFiscalPeriod(value, { ...calendar, yearLabel })?.year).toBe(
        year,
      );
      expect(getQuarter(value, { fiscalYearStartMonth, yearLabel })?.year).toBe(
        year,
      );
    },
  );
});

describe("getFiscalPeriod calendar validation", () => {
  it("returns null for the 1.19 shape, which has no extraWeek or yearLabel", () => {
    expect(
      getFiscalPeriod("2024-06-15", {
        pattern: "4-5-4",
        yearEndsOn: "2026-01-31",
      } as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    field
    ${"extraWeek"}
    ${"yearLabel"}
  `("returns null when NRF lacks $field", ({ field }) => {
    const calendar: Record<string, unknown> = { ...nrf };
    delete calendar[field];

    expect(
      getFiscalPeriod("2024-06-15", calendar as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    extraWeek        | label
    ${"lastQuarter"} | ${"'lastQuarter'"}
    ${"middle"}      | ${"'middle'"}
    ${""}            | ${"''"}
    ${12}            | ${"12"}
    ${null}          | ${"null"}
  `("returns null when extraWeek is $label", ({ extraWeek }) => {
    expect(
      getFiscalPeriod("2024-06-15", {
        ...nrf,
        extraWeek,
      } as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    yearLabel       | label
    ${"fiscalYear"} | ${"'fiscalYear'"}
    ${"StartYear"}  | ${"'StartYear'"}
    ${""}           | ${"''"}
    ${2024}         | ${"2024"}
    ${null}         | ${"null"}
  `("returns null when yearLabel is $label", ({ yearLabel }) => {
    expect(
      getFiscalPeriod("2024-06-15", {
        ...nrf,
        yearLabel,
      } as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    field
    ${"pattern"}
    ${"yearEndsOn"}
    ${"extraWeek"}
    ${"yearLabel"}
  `("returns null when the $field getter throws", ({ field }) => {
    const calendar = { ...nrf };
    Object.defineProperty(calendar, field, {
      get() {
        throw new Error("hostile getter");
      },
    });

    expect(getFiscalPeriod("2024-06-15", calendar)).toBeNull();
  });

  // A getter that changes its answer would make validation and use disagree. Each field is
  // read once, so the first answer is the one validated and used. 2023-02-26 is week 5 of
  // NRF fiscal 2023, a 53-week year: period 1 under firstPeriod, period 2 under lastPeriod.
  // Under "2024-02-03" (Saturdays nearest 3 February) its year opens 2023-02-05: week 4.
  it.each`
    field           | first            | later           | expected
    ${"extraWeek"}  | ${"firstPeriod"} | ${"lastPeriod"} | ${{ year: 2023, period: 1, week: 5 }}
    ${"yearLabel"}  | ${"endYear"}     | ${"startYear"}  | ${{ year: 2024, period: 2, week: 5 }}
    ${"pattern"}    | ${"5-4-4"}       | ${"4-5-4"}      | ${{ year: 2023, period: 1, week: 5 }}
    ${"yearEndsOn"} | ${"2024-02-03"}  | ${"2026-01-31"} | ${{ year: 2023, period: 1, week: 4 }}
  `(
    "uses the first value of a $field getter that returns $first then $later: $expected",
    ({ field, first, later, expected }) => {
      let reads = 0;
      const calendar = { ...nrf };
      Object.defineProperty(calendar, field, {
        get() {
          reads++;
          return reads === 1 ? first : later;
        },
      });

      expect(getFiscalPeriod("2023-02-26", calendar)).toEqual(expected);
      expect(reads).toBe(1);
    },
  );
});
