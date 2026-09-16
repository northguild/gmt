import { Temporal } from "@js-temporal/polyfill";
import { endOfUtc } from "./endOfUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("endOfUtc", () => {
  // Override: Feb 29 leap day with non-zero time for thorough boundary testing
  // Canonical utcStart2024Jan01StartOfDay gives identity-like results for some units
  const leapDayInput = "2024-02-29T12:34:56Z";

  it.each`
    value                         | unit             | expected
    ${leapDayInput}               | ${"year"}        | ${"2024-12-31T23:59:59.999999999Z"}
    ${leapDayInput}               | ${"month"}       | ${"2024-02-29T23:59:59.999999999Z"}
    ${leapDayInput}               | ${"week"}        | ${"2024-03-03T23:59:59.999999999Z"}
    ${leapDayInput}               | ${"day"}         | ${"2024-02-29T23:59:59.999999999Z"}
    ${leapDayInput}               | ${"hour"}        | ${"2024-02-29T12:59:59.999999999Z"}
    ${leapDayInput}               | ${"minute"}      | ${"2024-02-29T12:34:59.999999999Z"}
    ${"2024-02-29T12:34:56.123Z"} | ${"millisecond"} | ${"2024-02-29T12:34:56.123999999Z"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUtc(value, unit as never)).toBe(expected);
    },
  );

  it.each`
    value           | unit      | weekStartsOn | expected
    ${leapDayInput} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59.999999999Z"}
    ${leapDayInput} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59.999999999Z"}
  `(
    "returns $expected for $value and unit $unit with weekStartsOn $weekStartsOn",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfUtc(value, unit as never, { weekStartsOn })).toBe(expected);
    },
  );

  // An explicit fractionalSecondDigits keeps Temporal's truncating `toString` of the same end
  // (23:59:59.999999999Z), as `Instant.prototype.toString` specifies.
  it.each`
    value           | unit       | fractionalSecondDigits | expected
    ${leapDayInput} | ${"month"} | ${0}                   | ${"2024-02-29T23:59:59Z"}
    ${leapDayInput} | ${"month"} | ${3}                   | ${"2024-02-29T23:59:59.999Z"}
    ${leapDayInput} | ${"month"} | ${6}                   | ${"2024-02-29T23:59:59.999999Z"}
    ${leapDayInput} | ${"month"} | ${9}                   | ${"2024-02-29T23:59:59.999999999Z"}
  `(
    "returns $expected for $value and unit $unit with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfUtc(value, unit, { fractionalSecondDigits })).toBe(expected);
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
    ${"-271821-04-20T12:00:00Z"} | ${"day"}   | ${undefined} | ${"-271821-04-20T23:59:59.999999999Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59.999999999Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24T23:59:59.999999999Z"}
    ${"-271821-04-20T00:00:00Z"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59.999999999Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"month"} | ${undefined} | ${"-271821-04-30T23:59:59.999999999Z"}
    ${"-271821-04-20T12:00:00Z"} | ${"year"}  | ${undefined} | ${"-271821-12-31T23:59:59.999999999Z"}
  `(
    "returns $expected as the $unit end of the first-day instant $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfUtc(value, unit, { weekStartsOn })).toBe(expected);
    },
  );
});

// Calendar & zone semantics §3: end = next start − 1 ns, and never before the input. A Temporal
// string without a fraction reads as .000000000 (ParseISODateTime), so a truncated end would name
// next start − 1 s and fall before an input inside the unit's final second. Each `expected` is
// `Temporal.Instant.from(nextStart).subtract({ nanoseconds: 1 })` on the plain polyfill.
describe("endOfUtc for an input inside the unit's final second", () => {
  it.each`
    value                             | unit             | nextStart                        | expected
    ${"2024-03-31T23:59:59.5Z"}       | ${"year"}        | ${"2025-01-01T00:00:00Z"}        | ${"2024-12-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"month"}       | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"week"}        | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"day"}         | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"hour"}        | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"minute"}      | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-31T23:59:59.5Z"}       | ${"second"}      | ${"2024-04-01T00:00:00Z"}        | ${"2024-03-31T23:59:59.999999999Z"}
    ${"2024-03-15T14:30:45.123456Z"}  | ${"millisecond"} | ${"2024-03-15T14:30:45.124Z"}    | ${"2024-03-15T14:30:45.123999999Z"}
    ${"2024-03-15T14:30:45.1234567Z"} | ${"microsecond"} | ${"2024-03-15T14:30:45.123457Z"} | ${"2024-03-15T14:30:45.123456999Z"}
  `(
    "returns $expected (next start $nextStart − 1 ns) as the $unit end of $value",
    ({ value, unit, nextStart, expected }) => {
      const end = endOfUtc(value, unit);

      expect(end).toBe(expected);
      expect(
        Temporal.Instant.from(end).equals(
          Temporal.Instant.from(nextStart).subtract({ nanoseconds: 1 }),
        ),
      ).toBe(true);
      expect(Temporal.Instant.compare(end, value)).toBeGreaterThanOrEqual(0);
    },
  );
});
