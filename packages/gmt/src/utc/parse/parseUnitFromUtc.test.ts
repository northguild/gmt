import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseUnitFromUtc } from "./parseUnitFromUtc";

describe("parseUnitFromUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each`
    value                         | unit             | expected
    ${"2024-03-17T14:30:45Z"}     | ${"year"}        | ${"2024"}
    ${"2024-03-17T14:30:45Z"}     | ${"month"}       | ${"03"}
    ${"2024-03-17T14:30:45Z"}     | ${"day"}         | ${"17"}
    ${"2024-03-17T14:30:45Z"}     | ${"hour"}        | ${"14"}
    ${"2024-03-17T14:30:45Z"}     | ${"minute"}      | ${"30"}
    ${"2024-03-17T14:30:45Z"}     | ${"second"}      | ${"45"}
    ${"2024-03-17T14:30:45.123Z"} | ${"millisecond"} | ${"123"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromUtc(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid-date"}
    ${"2024-03-17T14:30:45"}
    ${"2024-03-17T14:30:45+00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromUtc(invalidValue, "year")).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseUnitFromUtc("2024-03-17T14:30:45Z", "year");
    expect(result).toBe("");
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseUnitFromUtc week with a year outside 0000-9999", () => {
  it.each`
    value                        | expected
    ${"+010000-01-01T00:00:00Z"} | ${"52"}
    ${"-000001-01-01T00:00:00Z"} | ${"53"}
  `("returns ISO week $expected for $value", ({ value, expected }) => {
    expect(parseUnitFromUtc(value, "week")).toBe(expected);
  });
});
