import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseSecondFromTime } from "./parseSecondFromTime";

describe("parseSecondFromTime", () => {
  it.each`
    value         | expected
    ${"12:30:45"} | ${"45"}
    ${"12:00:00"} | ${"00"}
    ${"23:59:59"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseSecondFromTime(value)).toBe(expected);
  });

  it.each`
    invalidTime
    ${"invalid"}
    ${"25:00:00"}
  `("returns empty string for invalid time $invalidTime", ({ invalidTime }) => {
    expect(parseSecondFromTime(invalidTime)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseSecondFromTime("12:30:45");
    expect(result).toBe("");
  });
});
