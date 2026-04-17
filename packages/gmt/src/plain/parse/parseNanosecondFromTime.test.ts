import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseNanosecondFromTime } from "./parseNanosecondFromTime";

describe("parseNanosecondFromTime", () => {
  it.each`
    value                   | expected
    ${"14:30:45"}           | ${"000"}
    ${"14:30:45.123"}       | ${"000"}
    ${"14:30:45.123456"}    | ${"000"}
    ${"14:30:45.123456789"} | ${"789"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseNanosecondFromTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"25:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseNanosecondFromTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseNanosecondFromTime("14:30:45.123456789");
    expect(result).toBe("");
  });
});
