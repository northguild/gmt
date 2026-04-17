import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseDayOfWeekFromUtc } from "./parseDayOfWeekFromUtc";

describe("parseDayOfWeekFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${7}
    ${"2024-03-18T00:00:00Z"} | ${1}
    ${"2024-03-16T00:00:00Z"} | ${6}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseDayOfWeekFromUtc(value)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseDayOfWeekFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBeNull();
  });
});
