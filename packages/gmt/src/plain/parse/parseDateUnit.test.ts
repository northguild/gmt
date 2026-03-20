import { parseDateUnit } from "./parseDateUnit";

describe("parseDateUnit", () => {
  it.each`
    value           | unit       | expected
    ${"2024-02-29"} | ${"year"}  | ${"2024"}
    ${"2024-02-29"} | ${"month"} | ${"02"}
    ${"2024-02-29"} | ${"day"}   | ${"29"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseDateUnit(value, unit)).toBe(expected);
  });

  it.each`
    value           | unit       | expected
    ${"0001-01-01"} | ${"year"}  | ${"1"}
    ${"2024-12-31"} | ${"month"} | ${"12"}
    ${"2024-03-01"} | ${"day"}   | ${"01"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseDateUnit(value, unit)).toBe(expected);
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
      expect(parseDateUnit(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    unit         | expected
    ${"week"}    | ${""}
    ${"hour"}    | ${""}
    ${""}        | ${""}
    ${null}      | ${""}
    ${undefined} | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseDateUnit("2024-02-29", unit as never)).toBe(expected);
  });
});
