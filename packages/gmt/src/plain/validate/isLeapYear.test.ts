import { isLeapYear } from "./isLeapYear";

describe("isLeapYear", () => {
  it.each`
    value
    ${"2016-02-29"}
    ${"2020-02-29"}
    ${"2024-02-29"}
    ${"2028-02-29"}
  `("returns true for leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(true);
  });

  it.each`
    value
    ${"2019-01-01"}
    ${"1900-02-29"}
    ${"2100-02-29"}
  `("returns false for non-leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });

  it.each`
    value
    ${"invalid-date"}
    ${"2020-02-30"}
    ${"2021-13-01"}
  `("returns false for invalid date string: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });
});
