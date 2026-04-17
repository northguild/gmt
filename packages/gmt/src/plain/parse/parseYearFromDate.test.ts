import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseYearFromDate } from "./parseYearFromDate";

describe("parseYearFromDate", () => {
  it.each`
    value           | expected
    ${"2024-03-15"} | ${"2024"}
    ${"0001-01-01"} | ${"1"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseYearFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid"}
    ${"2024-02-30"}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseYearFromDate(invalidDate)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseYearFromDate("2024-02-29");
    expect(result).toBe("");
  });
});
