import { parseDateTimeUnit } from "./parseDateTimeUnit";

describe("parseDateTimeUnit", () => {
  it.each`
    value                        | unit             | expected
    ${"2024-02-29T14:30:45.123"} | ${"year"}        | ${"2024"}
    ${"2024-02-29T14:30:45.123"} | ${"month"}       | ${"02"}
    ${"2024-02-29T14:30:45.123"} | ${"day"}         | ${"29"}
    ${"2024-02-29T14:30:45.123"} | ${"hour"}        | ${"14"}
    ${"2024-02-29T14:30:45.123"} | ${"minute"}      | ${"30"}
    ${"2024-02-29T14:30:45.123"} | ${"second"}      | ${"45"}
    ${"2024-02-29T14:30:45.123"} | ${"millisecond"} | ${"123"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseDateTimeUnit(value, unit)).toBe(expected);
  });

  it.each`
    value                        | unit        | expected
    ${"0001-01-01T00:00:00.001"} | ${"year"}   | ${"1"}
    ${"2024-12-31T23:59:59"}     | ${"month"}  | ${"12"}
    ${"2024-03-01T08:05:09"}     | ${"minute"} | ${"05"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseDateTimeUnit(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29T24:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseDateTimeUnit(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    unit             | expected
    ${"week"}        | ${""}
    ${"microsecond"} | ${""}
    ${""}            | ${""}
    ${null}          | ${""}
    ${undefined}     | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseDateTimeUnit("2024-02-29T14:30:45.123", unit as never)).toBe(
      expected,
    );
  });
});
