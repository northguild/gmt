import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getOrdinalDate } from "./getOrdinalDate";

describe("getOrdinalDate", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${{ year: 2024, dayOfYear: 1 }}
    ${"2024-06-15"} | ${{ year: 2024, dayOfYear: 167 }}
    ${"2023-12-31"} | ${{ year: 2023, dayOfYear: 365 }}
    ${"1970-01-01"} | ${{ year: 1970, dayOfYear: 1 }}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getOrdinalDate(value)).toEqual(expected);
  });

  it.each`
    value           | expected                          | description
    ${"2024-02-29"} | ${{ year: 2024, dayOfYear: 60 }}  | ${"the leap day itself"}
    ${"2024-03-01"} | ${{ year: 2024, dayOfYear: 61 }}  | ${"the day after it"}
    ${"2023-03-01"} | ${{ year: 2023, dayOfYear: 60 }}  | ${"the same date in a common year"}
    ${"2024-12-31"} | ${{ year: 2024, dayOfYear: 366 }} | ${"the 366th day of a leap year"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(getOrdinalDate(value)).toEqual(expected);
  });

  it.each`
    value                        | expected                          | description
    ${"2024-12-30T00:00:00"}     | ${{ year: 2024, dayOfYear: 365 }} | ${"a zoneless datetime at midnight"}
    ${"2024-12-30T23:59:59.999"} | ${{ year: 2024, dayOfYear: 365 }} | ${"the same local day at its last millisecond"}
  `(
    "reads the date half of $value as $expected ($description)",
    ({ value, expected }) => {
      expect(getOrdinalDate(value)).toEqual(expected);
    },
  );

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00"}                   | ${"an offset datetime"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
  `(
    "returns null for $value ($description), which names a moment rather than a calendar date",
    ({ value }) => {
      expect(getOrdinalDate(value)).toBeNull();
    },
  );

  it.each`
    value                    | description
    ${"invalid"}             | ${"an unparseable string"}
    ${""}                    | ${"an empty string"}
    ${"2023-02-29"}          | ${"a leap day in a common year"}
    ${"2024-12-31T23:59:60"} | ${"a leap second"}
  `("returns null when $value is $description", ({ value }) => {
    expect(getOrdinalDate(value)).toBeNull();
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
    expect(getOrdinalDate(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getOrdinalDate("2024-06-15")).toBeNull();
  });
});
