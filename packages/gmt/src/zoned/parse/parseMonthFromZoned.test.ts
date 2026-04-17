import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseMonthFromZoned } from "./parseMonthFromZoned";

describe("parseMonthFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${"03"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"01"}
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"12"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMonthFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMonthFromZoned(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseMonthFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBe("");
  });
});
