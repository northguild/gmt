import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseDayFromDate } from "./parseDayFromDate";

describe("parseDayFromDate", () => {
  it.each`
    value           | expected
    ${"2024-03-15"} | ${"15"}
    ${"2024-12-31"} | ${"31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid"}
    ${"2024-02-30"}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseDayFromDate(invalidDate)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseDayFromDate("2024-02-29");
    expect(result).toBe("");
  });
});
