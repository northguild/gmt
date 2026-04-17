import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseMicrosecondFromTime } from "./parseMicrosecondFromTime";

describe("parseMicrosecondFromTime", () => {
  it.each`
    value                | expected
    ${"14:30:45"}        | ${"000"}
    ${"14:30:45.123"}    | ${"000"}
    ${"14:30:45.123456"} | ${"456"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMicrosecondFromTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"25:00:00"}
  `(
    "returns empty string for invalid time $invalidValue",
    ({ invalidValue }) => {
      expect(parseMicrosecondFromTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseMicrosecondFromTime("14:30:45");
    expect(result).toBe("");
  });
});
