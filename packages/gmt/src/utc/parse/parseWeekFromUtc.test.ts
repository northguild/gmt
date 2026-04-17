import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateFromThrow,
} from "../../test/mocks";
import { parseWeekFromUtc } from "./parseWeekFromUtc";

describe("parseWeekFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${11}
    ${"2024-01-01T00:00:00Z"} | ${1}
    ${"2024-01-07T00:00:00Z"} | ${1}
    ${"2024-01-08T00:00:00Z"} | ${2}
    ${"2024-12-31T23:59:59Z"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromUtc(value)).toBe(expected);
  });

  it.each`
    value                     | weekStartsOn | expected
    ${"2024-01-01T00:00:00Z"} | ${"monday"}  | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"sunday"}  | ${1}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn",
    ({ value, weekStartsOn, expected }) => {
      expect(
        parseWeekFromUtc(value, { weekStartsOn: weekStartsOn as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseWeekFromUtc(value)).toBeNull();
  });

  it("returns valid result when Temporal.Instant.from throws but fallback works", () => {
    mockTemporalInstantFromThrow();
    const result = parseWeekFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe(11);
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseWeekFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBeNull();
  });
});
