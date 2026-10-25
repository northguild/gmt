import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseMillisecondFromTime } from "./parseMillisecondFromTime";

describe("parseMillisecondFromTime", () => {
  it.each`
    value             | expected | label
    ${"12:30:45"}     | ${"000"} | ${"no fraction"}
    ${"12:30:45.000"} | ${"000"} | ${"zero fraction"}
    ${"12:30:45.123"} | ${"123"} | ${"fraction 123"}
    ${"23:59:59.999"} | ${"999"} | ${"largest fraction"}
  `("returns $expected for $value ($label)", ({ value, expected }) => {
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
