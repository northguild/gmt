import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseMinuteFromTime } from "./parseMinuteFromTime";

describe("parseMinuteFromTime", () => {
  it.each`
    value         | expected
    ${"12:30:00"} | ${"30"}
    ${"12:00:00"} | ${"00"}
    ${"23:59:59"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMinuteFromTime(value)).toBe(expected);
  });

  it.each`
    invalidTime
    ${"invalid"}
    ${"25:00:00"}
  `("returns empty string for invalid time $invalidTime", ({ invalidTime }) => {
    expect(parseMinuteFromTime(invalidTime)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseMinuteFromTime("00:00:00");
    expect(result).toBe("");
  });
});
