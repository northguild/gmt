import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseHourFromZoned } from "./parseHourFromZoned";

describe("parseHourFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${"14"}
    ${"2024-03-15T00:00:00+00:00[UTC]"} | ${"00"}
    ${"2024-03-15T23:59:59+00:00[UTC]"} | ${"23"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseHourFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseHourFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseHourFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBe("");
  });
});
