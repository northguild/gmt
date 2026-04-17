import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseYearFromZoned } from "./parseYearFromZoned";

describe("parseYearFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${"2024"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024"}
    ${"1970-01-01T00:00:00+00:00[UTC]"} | ${"1970"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseYearFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseYearFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseYearFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBe("");
  });
});
