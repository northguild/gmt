import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseSecondFromZoned } from "./parseSecondFromZoned";

describe("parseSecondFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${"45"}
    ${"2024-03-15T14:30:00+00:00[UTC]"} | ${"00"}
    ${"2024-03-15T14:30:59+00:00[UTC]"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseSecondFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseSecondFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseSecondFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBe("");
  });
});
