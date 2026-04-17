import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseMillisecondFromZoned } from "./parseMillisecondFromZoned";

describe("parseMillisecondFromZoned", () => {
  it.each`
    value                                   | expected
    ${"2024-03-15T14:30:45.123+00:00[UTC]"} | ${"123"}
    ${"2024-03-15T14:30:45.000+00:00[UTC]"} | ${"000"}
    ${"2024-03-15T14:30:45.999+00:00[UTC]"} | ${"999"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMillisecondFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMillisecondFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseMillisecondFromZoned(
      "2024-03-15T14:30:45.123+00:00[UTC]",
    );
    expect(result).toBe("");
  });
});
