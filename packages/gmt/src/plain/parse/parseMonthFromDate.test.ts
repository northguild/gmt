import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseMonthFromDate } from "./parseMonthFromDate";

describe("parseMonthFromDate", () => {
  it.each`
    value           | expected
    ${"2024-03-15"} | ${"03"}
    ${"2024-12-31"} | ${"12"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMonthFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid"}
    ${"2024-02-30"}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseMonthFromDate(invalidDate)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseMonthFromDate("2024-02-29");
    expect(result).toBe("");
  });
});
