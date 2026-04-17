import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseWeekFromDate } from "./parseWeekFromDate";

describe("parseWeekFromDate", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${1}
    ${"2024-01-07"} | ${1}
    ${"2024-01-08"} | ${2}
    ${"2024-02-29"} | ${9}
    ${"2024-12-31"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
  `("returns null for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseWeekFromDate(invalidDate)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseWeekFromDate("2024-02-29");
    expect(result).toBeNull();
  });
});
