import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getQuarter } from "./getQuarter";

describe("getQuarter", () => {
  it.each`
    value           | expected
    ${"2024-01-15"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-03-31"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-04-01"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-30"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-07-01"} | ${{ year: 2024, quarter: 3 }}
    ${"2024-09-30"} | ${{ year: 2024, quarter: 3 }}
    ${"2024-10-01"} | ${{ year: 2024, quarter: 4 }}
    ${"2024-12-31"} | ${{ year: 2024, quarter: 4 }}
  `("returns $expected for $value with no options", ({ value, expected }) => {
    expect(getQuarter(value)).toEqual(expected);
  });

  it.each`
    value           | expected
    ${"2024-01-15"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-12-31"} | ${{ year: 2024, quarter: 4 }}
  `(
    "returns $expected for $value with an explicit fiscalYearStartMonth of 1, matching the default",
    ({ value, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth: 1 })).toEqual(expected);
    },
  );

  it.each`
    value           | fiscalYearStartMonth | expected                      | description
    ${"2024-04-01"} | ${4}                 | ${{ year: 2024, quarter: 1 }} | ${"the first day of an April fiscal year"}
    ${"2024-06-30"} | ${4}                 | ${{ year: 2024, quarter: 1 }} | ${"the last day of its Q1"}
    ${"2024-07-01"} | ${4}                 | ${{ year: 2024, quarter: 2 }} | ${"the first day of its Q2"}
    ${"2025-03-31"} | ${4}                 | ${{ year: 2024, quarter: 4 }} | ${"its last day, still labelled by the year it started in"}
    ${"2024-03-31"} | ${4}                 | ${{ year: 2023, quarter: 4 }} | ${"the day before it, in the previous fiscal year"}
    ${"2024-07-01"} | ${7}                 | ${{ year: 2024, quarter: 1 }} | ${"a July fiscal year opening"}
    ${"2024-06-30"} | ${7}                 | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-10-01"} | ${10}                | ${{ year: 2024, quarter: 1 }} | ${"an October fiscal year opening"}
    ${"2024-09-30"} | ${10}                | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-12-31"} | ${12}                | ${{ year: 2024, quarter: 1 }} | ${"a December fiscal year opening on its first month"}
    ${"2024-11-30"} | ${12}                | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-02-29"} | ${2}                 | ${{ year: 2024, quarter: 1 }} | ${"a leap day in a February fiscal year"}
  `(
    "returns $expected for $value with fiscalYearStartMonth $fiscalYearStartMonth ($description)",
    ({ value, fiscalYearStartMonth, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth })).toEqual(expected);
    },
  );

  it.each`
    fiscalYearStartMonth | expected
    ${1}                 | ${{ year: 2024, quarter: 2 }}
    ${2}                 | ${{ year: 2024, quarter: 2 }}
    ${3}                 | ${{ year: 2024, quarter: 2 }}
    ${4}                 | ${{ year: 2024, quarter: 1 }}
    ${5}                 | ${{ year: 2024, quarter: 1 }}
    ${6}                 | ${{ year: 2024, quarter: 1 }}
    ${7}                 | ${{ year: 2023, quarter: 4 }}
    ${8}                 | ${{ year: 2023, quarter: 4 }}
    ${9}                 | ${{ year: 2023, quarter: 4 }}
    ${10}                | ${{ year: 2023, quarter: 3 }}
    ${11}                | ${{ year: 2023, quarter: 3 }}
    ${12}                | ${{ year: 2023, quarter: 3 }}
  `(
    "places 2024-06-15 in $expected when the fiscal year starts in month $fiscalYearStartMonth",
    ({ fiscalYearStartMonth, expected }) => {
      expect(getQuarter("2024-06-15", { fiscalYearStartMonth })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value                    | expected
    ${"2024-04-01T00:00:00"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-03-31T23:59:59"} | ${{ year: 2023, quarter: 4 }}
  `(
    "reads the date half of the zoneless datetime $value as $expected",
    ({ value, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth: 4 })).toEqual(expected);
    },
  );

  it.each`
    options                                | description
    ${undefined}                           | ${"no options object"}
    ${{}}                                  | ${"an empty options object"}
    ${{ fiscalYearStartMonth: undefined }} | ${"an explicit undefined"}
    ${{ fiscalYearStartMonth: null }}      | ${"an explicit null"}
  `("falls back to a January fiscal year for $description", ({ options }) => {
    expect(getQuarter("2024-06-15", options)).toEqual({
      year: 2024,
      quarter: 2,
    });
  });

  it.each`
    fiscalYearStartMonth        | description
    ${0}                        | ${"below the first month"}
    ${13}                       | ${"above the last month"}
    ${-1}                       | ${"negative"}
    ${1.5}                      | ${"not an integer"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"infinite"}
    ${"4"}                      | ${"a string"}
  `(
    "returns null when fiscalYearStartMonth $fiscalYearStartMonth is $description",
    ({ fiscalYearStartMonth }) => {
      expect(getQuarter("2024-06-15", { fiscalYearStartMonth })).toBeNull();
    },
  );

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
    ${"invalid"}                                     | ${"an unparseable string"}
    ${""}                                            | ${"an empty string"}
    ${"2024-02-30"}                                  | ${"a date that does not exist"}
  `("returns null when $value is $description", ({ value }) => {
    expect(getQuarter(value)).toBeNull();
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
    expect(getQuarter(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getQuarter("2024-06-15")).toBeNull();
  });
});
