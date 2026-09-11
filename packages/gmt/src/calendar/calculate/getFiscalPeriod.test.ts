import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import type { FiscalCalendar } from "../../types";
import { getFiscalPeriod } from "./getFiscalPeriod";

/**
 * The NRF 4-5-4 retail calendar, stated as its published rule: "the Saturday nearest to
 * January 31". 2026-01-31 is a Saturday falling exactly on January 31, so it names both
 * halves of the rule without drift.
 */
const nrf: FiscalCalendar = { pattern: "4-5-4", yearEndsOn: "2026-01-31" };

describe("getFiscalPeriod", () => {
  it.each`
    value           | expected
    ${"2024-02-04"} | ${{ year: 2024, period: 1, week: 1 }}
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
    ${"2023-01-29"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"the first day of NRF fiscal 2023"}
    ${"2024-01-27"} | ${{ year: 2023, period: 12, week: 52 }} | ${"the last day of its 52nd week"}
    ${"2024-01-28"} | ${{ year: 2023, period: 12, week: 53 }} | ${"the first day of the 53rd week"}
    ${"2024-02-03"} | ${{ year: 2023, period: 12, week: 53 }} | ${"its last day, still week 53"}
    ${"2024-02-04"} | ${{ year: 2024, period: 1, week: 1 }}   | ${"the first day of the next fiscal year"}
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
    ${"2017-01-29"} | ${{ year: 2017, period: 1, week: 1 }}   | ${"NRF fiscal 2017 opens"}
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
        getFiscalPeriod(value, { pattern, yearEndsOn: "2026-01-31" }),
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
        getFiscalPeriod("2024-01-28", { pattern, yearEndsOn: "2026-01-31" }),
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
        getFiscalPeriod(value, { pattern: "4-4-5", yearEndsOn: "2024-06-29" }),
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
        getFiscalPeriod("2023-01-29", { pattern: "4-5-4", yearEndsOn }),
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
        getFiscalPeriod(value, { pattern: "4-5-4", yearEndsOn: "2022-12-31" }),
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
        getFiscalPeriod(value, { pattern: "4-5-4", yearEndsOn: "2033-01-01" }),
      ).toEqual(expected);
    },
  );

  it.each`
    value           | expected                                | description
    ${"2023-01-01"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"one fiscal year opens"}
    ${"2023-12-30"} | ${{ year: 2023, period: 12, week: 52 }} | ${"and closes, both inside 2023"}
    ${"2023-12-31"} | ${{ year: 2023, period: 1, week: 1 }}   | ${"so the next one collides on the label — a documented limit of a rule anchored near 1 January"}
    ${"2024-12-29"} | ${{ year: 2023, period: 12, week: 53 }} | ${"and no fiscal year is labelled 2024 at all"}
  `(
    "labels by the year a fiscal year starts in, collisions included: $value is $expected ($description)",
    ({ value, expected }) => {
      expect(
        getFiscalPeriod(value, { pattern: "4-5-4", yearEndsOn: "2027-01-02" }),
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
    pattern      | description
    ${"4-5-5"}   | ${"a pattern that is not one of the three"}
    ${"454"}     | ${"a pattern missing its separators"}
    ${"4-5-4 "}  | ${"a pattern with trailing whitespace"}
    ${""}        | ${"an empty pattern"}
    ${undefined} | ${"no pattern"}
    ${null}      | ${"a null pattern"}
    ${454}       | ${"a non-string pattern"}
  `("returns null when pattern is $pattern ($description)", ({ pattern }) => {
    expect(
      getFiscalPeriod("2024-06-15", {
        pattern,
        yearEndsOn: "2026-01-31",
      } as unknown as FiscalCalendar),
    ).toBeNull();
  });

  it.each`
    yearEndsOn                                       | description
    ${"invalid"}                                     | ${"an unparseable string"}
    ${""}                                            | ${"an empty string"}
    ${"2026-02-30"}                                  | ${"a date that does not exist"}
    ${"2026-01-31T00:00:00"}                         | ${"a datetime rather than a date"}
    ${"2026-01-31T00:00:00Z"}                        | ${"an instant"}
    ${"2026-01-31T00:00:00-05:00[America/New_York]"} | ${"a zoned datetime"}
    ${undefined}                                     | ${"absent"}
    ${null}                                          | ${"null"}
    ${20260131}                                      | ${"a number"}
  `(
    "returns null when yearEndsOn is $yearEndsOn ($description)",
    ({ yearEndsOn }) => {
      expect(
        getFiscalPeriod("2024-06-15", {
          pattern: "4-5-4",
          yearEndsOn,
        } as unknown as FiscalCalendar),
      ).toBeNull();
    },
  );

  it.each`
    calendar     | description
    ${undefined} | ${"no calendar"}
    ${null}      | ${"a null calendar"}
    ${{}}        | ${"an empty calendar"}
    ${"4-5-4"}   | ${"a string instead of a calendar"}
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
  `("returns null when $value is $description", ({ value }) => {
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
});
