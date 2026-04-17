import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseMillisecondFromTime } from "./parseMillisecondFromTime";

describe("parseMillisecondFromTime", () => {
  it.each`
    value             | expected
    ${"12:30:45"}     | ${"000"}
    ${"12:30:45.000"} | ${"000"}
    ${"12:30:45.123"} | ${"123"}
    ${"12:30:45.000"} | ${"000"}
    ${"23:59:59.999"} | ${"999"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMillisecondFromTime(value)).toBe(expected);
  });

  it.each`
    invalidTime
    ${"invalid"}
    ${"25:00:00"}
  `("returns empty string for invalid time $invalidTime", ({ invalidTime }) => {
    expect(parseMillisecondFromTime(invalidTime)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseMillisecondFromTime("12:30:45.123");
    expect(result).toBe("");
  });
});
