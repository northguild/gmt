import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseDayOfWeekFromDate } from "./parseDayOfWeekFromDate";

describe("parseDayOfWeekFromDate", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${1}
    ${"2024-01-07"} | ${7}
    ${"2024-01-08"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid"}
    ${"2024-02-30"}
  `("returns null for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseDayOfWeekFromDate(invalidDate)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseDayOfWeekFromDate("2024-02-29");
    expect(result).toBeNull();
  });
});
