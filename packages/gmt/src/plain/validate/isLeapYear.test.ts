import { isLeapYear } from "./isLeapYear";

describe("isLeapYear", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2020-02-29"}
    ${"2016-02-29"}
    ${"2000-02-29"}
  `("returns true for leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(true);
  });

  it.each`
    value
    ${"2023-01-01"}
    ${"1900-02-28"}
    ${"2100-02-28"}
  `("returns false for non-leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-13-01"}
    ${"not-a-date"}
  `("returns false for invalid date string: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });
});
