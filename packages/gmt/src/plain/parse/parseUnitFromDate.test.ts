import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseUnitFromDate } from "./parseUnitFromDate";

describe("parseUnitFromDate", () => {
  it.each`
    value           | unit           | expected
    ${"2024-02-29"} | ${"year"}      | ${"2024"}
    ${"2024-02-29"} | ${"month"}     | ${"02"}
    ${"2024-02-29"} | ${"day"}       | ${"29"}
    ${"2024-02-29"} | ${"week"}      | ${"9"}
    ${"2024-02-29"} | ${"dayOfWeek"} | ${"4"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromDate(value, unit)).toBe(expected);
  });

  it.each`
    value           | unit       | expected
    ${"0001-01-01"} | ${"year"}  | ${"1"}
    ${"2024-12-31"} | ${"month"} | ${"12"}
    ${"2024-03-01"} | ${"day"}   | ${"01"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromDate(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-date"}
    ${"2024-02-30"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid date $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromDate(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    unit         | expected
    ${"hour"}    | ${""}
    ${""}        | ${""}
    ${null}      | ${""}
    ${undefined} | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseUnitFromDate("2024-02-29", unit as never)).toBe(expected);
  });

  it("returns an empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseUnitFromDate("2024-02-29", "year");
    expect(result).toBe("");
  });
});
