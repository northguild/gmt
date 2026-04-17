import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseDayFromZoned } from "./parseDayFromZoned";

describe("parseDayFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${"15"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"01"}
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseDayFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseDayFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBe("");
  });
});
