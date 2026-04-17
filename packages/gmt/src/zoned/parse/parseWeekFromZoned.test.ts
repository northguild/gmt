import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseWeekFromZoned } from "./parseWeekFromZoned";

describe("parseWeekFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${11}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${1}
    ${"2024-01-07T00:00:00+00:00[UTC]"} | ${1}
    ${"2024-01-08T00:00:00+00:00[UTC]"} | ${2}
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromZoned(value)).toBe(expected);
  });

  it.each`
    value                               | weekStartsOn | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"monday"}  | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"sunday"}  | ${1}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn",
    ({ value, weekStartsOn, expected }) => {
      expect(
        parseWeekFromZoned(value, { weekStartsOn: weekStartsOn as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseWeekFromZoned(value)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseWeekFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBeNull();
  });
});
