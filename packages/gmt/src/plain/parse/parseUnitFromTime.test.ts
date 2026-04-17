import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseUnitFromTime } from "./parseUnitFromTime";

describe("parseUnitFromTime", () => {
  it.each`
    value             | unit             | expected
    ${"14:30:45.123"} | ${"hour"}        | ${"14"}
    ${"14:30:45.123"} | ${"minute"}      | ${"30"}
    ${"14:30:45.123"} | ${"second"}      | ${"45"}
    ${"14:30:45.123"} | ${"millisecond"} | ${"123"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromTime(value, unit)).toBe(expected);
  });

  it.each`
    value             | unit             | expected
    ${"00:00:00.001"} | ${"millisecond"} | ${"001"}
    ${"23:59:59"}     | ${"hour"}        | ${"23"}
    ${"08:05:09"}     | ${"minute"}      | ${"05"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromTime(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-time"}
    ${"24:00:00"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid time $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromTime(invalidValue as never, "hour")).toBe("");
    },
  );

  it.each`
    unit             | expected
    ${"day"}         | ${""}
    ${"microsecond"} | ${""}
    ${""}            | ${""}
    ${null}          | ${""}
    ${undefined}     | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseUnitFromTime("14:30:45.123", unit as never)).toBe(expected);
  });

  it("returns an empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseUnitFromTime("14:30:45.123", "hour");
    expect(result).toBe("");
  });
});
