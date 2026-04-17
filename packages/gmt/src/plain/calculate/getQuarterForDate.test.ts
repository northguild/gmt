import { getQuarterForDate } from "./getQuarterForDate";

describe("getQuarterForDate", () => {
  it.each`
    value           | expected
    ${"2024-01-15"} | ${1}
    ${"2024-02-15"} | ${1}
    ${"2024-03-15"} | ${1}
    ${"2024-04-15"} | ${2}
    ${"2024-05-15"} | ${2}
    ${"2024-06-15"} | ${2}
    ${"2024-07-15"} | ${3}
    ${"2024-08-15"} | ${3}
    ${"2024-09-15"} | ${3}
    ${"2024-10-15"} | ${4}
    ${"2024-11-15"} | ${4}
    ${"2024-12-15"} | ${4}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getQuarterForDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns null for invalid date $invalidDate", ({ invalidDate }) => {
    expect(getQuarterForDate(invalidDate)).toBeNull();
  });
});
