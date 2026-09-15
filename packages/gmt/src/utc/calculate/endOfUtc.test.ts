import { endOfUtc } from "./endOfUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("endOfUtc", () => {
  // Override: Feb 29 leap day with non-zero time for thorough boundary testing
  // Canonical utcStart2024Jan01StartOfDay gives identity-like results for some units
  const leapDayInput = "2024-02-29T12:34:56Z";

  it.each`
    value                         | unit             | expected
    ${leapDayInput}               | ${"year"}        | ${"2024-12-31T23:59:59Z"}
    ${leapDayInput}               | ${"month"}       | ${"2024-02-29T23:59:59Z"}
    ${leapDayInput}               | ${"week"}        | ${"2024-03-03T23:59:59Z"}
    ${leapDayInput}               | ${"day"}         | ${"2024-02-29T23:59:59Z"}
    ${leapDayInput}               | ${"hour"}        | ${"2024-02-29T12:59:59Z"}
    ${leapDayInput}               | ${"minute"}      | ${"2024-02-29T12:34:59Z"}
    ${"2024-02-29T12:34:56.123Z"} | ${"millisecond"} | ${"2024-02-29T12:34:56.123Z"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUtc(value, unit as never)).toBe(expected);
    },
  );

  it.each`
    value           | unit      | weekStartsOn | expected
    ${leapDayInput} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59Z"}
    ${leapDayInput} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59Z"}
  `(
    "returns $expected for $value and unit $unit with weekStartsOn $weekStartsOn",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfUtc(value, unit as never, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T12:34:56"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(endOfUtc(invalidValue as never, "day" as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfUtc("2024-02-29T12:34:56Z", invalidUnit as never)).toBe("");
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(endOfUtc(leapDayInput, "day")).toBe("");
  });

  // -271821-04-20T00:00:00Z is the first representable instant (a Tuesday). The start of its month,
  // year and week lies before the range, but every end is representable and must be returned.
  it.each`
    value                        | unit       | weekStartsOn | expected
    ${"-271821-04-20T12:00:00Z"} | ${"day"}   | ${undefined} | ${"-271821-04-20T23:59:59Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24T23:59:59Z"}
    ${"-271821-04-20T00:00:00Z"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"month"} | ${undefined} | ${"-271821-04-30T23:59:59Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"year"}  | ${undefined} | ${"-271821-12-31T23:59:59Z"}
  `(
    "returns $expected as the $unit end of the first-day instant $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfUtc(value, unit, { weekStartsOn })).toBe(expected);
    },
  );
});
