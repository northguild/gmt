import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getIsoWeekDate } from "./getIsoWeekDate";

describe("getIsoWeekDate", () => {
  it.each`
    value           | expected
    ${"2024-06-15"} | ${{ year: 2024, week: 24, weekday: 6 }}
    ${"2024-01-01"} | ${{ year: 2024, week: 1, weekday: 1 }}
    ${"2024-02-29"} | ${{ year: 2024, week: 9, weekday: 4 }}
    ${"2024-03-01"} | ${{ year: 2024, week: 9, weekday: 5 }}
    ${"1970-01-01"} | ${{ year: 1970, week: 1, weekday: 4 }}
    ${"2023-12-31"} | ${{ year: 2023, week: 52, weekday: 7 }}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getIsoWeekDate(value)).toEqual(expected);
  });

  it.each`
    value           | expected                                | description
    ${"2027-01-01"} | ${{ year: 2026, week: 53, weekday: 5 }} | ${"a January date in the previous week-year"}
    ${"2021-01-01"} | ${{ year: 2020, week: 53, weekday: 5 }} | ${"the same, in week 53 of 2020"}
    ${"2016-01-03"} | ${{ year: 2015, week: 53, weekday: 7 }} | ${"the last day of ISO week-year 2015"}
    ${"2016-01-04"} | ${{ year: 2016, week: 1, weekday: 1 }}  | ${"the first day of ISO week-year 2016"}
    ${"2024-12-30"} | ${{ year: 2025, week: 1, weekday: 1 }}  | ${"a December date in the next week-year"}
    ${"2024-12-31"} | ${{ year: 2025, week: 1, weekday: 2 }}  | ${"the same, one day later"}
    ${"2024-12-29"} | ${{ year: 2024, week: 52, weekday: 7 }} | ${"the last day that is still week-year 2024"}
    ${"2019-12-30"} | ${{ year: 2020, week: 1, weekday: 1 }}  | ${"a December Monday opening the next week-year"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(getIsoWeekDate(value)).toEqual(expected);
  });

  it.each`
    value           | expected                                | description
    ${"2015-12-28"} | ${{ year: 2015, week: 53, weekday: 1 }} | ${"the Monday opening 2015's 53rd week"}
    ${"2020-12-31"} | ${{ year: 2020, week: 53, weekday: 4 }} | ${"a 53-week ISO year"}
    ${"2026-12-31"} | ${{ year: 2026, week: 53, weekday: 4 }} | ${"another 53-week ISO year"}
  `("reports week 53 for $value ($description)", ({ value, expected }) => {
    expect(getIsoWeekDate(value)).toEqual(expected);
  });

  it.each`
    value                        | expected
    ${"2024-06-15T00:00:00"}     | ${{ year: 2024, week: 24, weekday: 6 }}
    ${"2024-06-15T23:59:59"}     | ${{ year: 2024, week: 24, weekday: 6 }}
    ${"2024-12-30T12:34:56.789"} | ${{ year: 2025, week: 1, weekday: 1 }}
  `(
    "reads the date half of the zoneless datetime $value as $expected",
    ({ value, expected }) => {
      expect(getIsoWeekDate(value)).toEqual(expected);
    },
  );

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00"}                   | ${"an offset datetime"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
    ${"2024-06-15T12:00:00+00:00[UTC]"}              | ${"a UTC-bracketed zoned datetime"}
  `(
    "returns null for $value ($description), which names a moment rather than a calendar date",
    ({ value }) => {
      expect(getIsoWeekDate(value)).toBeNull();
    },
  );

  it.each`
    value                        | description
    ${"invalid"}                 | ${"an unparseable string"}
    ${""}                        | ${"an empty string"}
    ${"2024-02-30"}              | ${"a date that does not exist"}
    ${"2024-13-01"}              | ${"a month out of range"}
    ${"2024-12-31T23:59:60"}     | ${"a leap second"}
    ${"2024-06"}                 | ${"a year-month with no day"}
    ${"5784-01-01[u-ca=hebrew]"} | ${"a calendar-annotated date"}
  `("returns null when $value is $description", ({ value }) => {
    expect(getIsoWeekDate(value)).toBeNull();
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
    expect(getIsoWeekDate(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getIsoWeekDate("2024-06-15")).toBeNull();
  });
});
