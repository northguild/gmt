import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseDayOfWeekFromZoned } from "./parseDayOfWeekFromZoned";

describe("parseDayOfWeekFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${5}
    ${"2024-03-18T00:00:00+00:00[UTC]"} | ${1}
    ${"2024-03-16T00:00:00+00:00[UTC]"} | ${6}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromZoned(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseDayOfWeekFromZoned(value)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseDayOfWeekFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBeNull();
  });
});
