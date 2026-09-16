import { Temporal } from "@js-temporal/polyfill";
import { endOfDateTime } from "./endOfDateTime";

describe("endOfDateTime", () => {
  it.each`
    value                              | unit             | expected
    ${"2024-02-29T12:34:56"}           | ${"year"}        | ${"2024-12-31T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"month"}       | ${"2024-02-29T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"week"}        | ${"2024-03-03T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"day"}         | ${"2024-02-29T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"hour"}        | ${"2024-02-29T12:59:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"minute"}      | ${"2024-02-29T12:34:59.999999999"}
    ${"2024-02-29T12:34:56"}           | ${"second"}      | ${"2024-02-29T12:34:56.999999999"}
    ${"2024-02-29T12:34:56.999"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999999999"}
    ${"2024-02-29T12:34:56.999999"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999999"}
    ${"2024-02-29T12:34:56.999999999"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(endOfDateTime(value, unit)).toBe(expected);
  });

  it.each`
    value                    | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56"} | ${"week"} | ${undefined} | ${"2024-03-03T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59.999999999"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59.999999999"}
  `(
    "returns $expected for $value, $unit, weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    value                              | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.999"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.999999"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.999999999"}
  `(
    "returns $expected for $value, $unit, fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfDateTime(value, unit, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  it.each`
    nonStringInput
    ${"invalid-datetime"}
    ${"2024-02-30T12:34:56"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T12:60:00"}
    ${"2024-02-29T12:34:60"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(endOfDateTime(nonStringInput, "month")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"decade"}
    ${"century"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfDateTime("2024-02-29T12:34:56", invalidUnit as never)).toBe("");
  });

  // A Sunday starts its own Sunday-first week, which ends the following Saturday (+6 days).
  it.each`
    value                    | weekStartsOn | expected                           | description
    ${"2024-03-03T12:00:00"} | ${"sunday"}  | ${"2024-03-09T23:59:59.999999999"} | ${"a Sunday starts its own Sunday-first week"}
    ${"2024-03-09T12:00:00"} | ${"sunday"}  | ${"2024-03-09T23:59:59.999999999"} | ${"a Saturday ends it"}
    ${"2024-03-03T12:00:00"} | ${"monday"}  | ${"2024-03-03T23:59:59.999999999"} | ${"a Sunday ends a Monday-first week"}
  `(
    "returns $expected as the week end of $value with weekStartsOn $weekStartsOn ($description)",
    ({ value, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, "week", { weekStartsOn })).toBe(expected);
    },
  );

  // -271821-04-19 is the first representable date (a Monday; the first PlainDateTime is
  // T00:00:00.000000001). The start of its month, year and Sunday-first week lies before the range,
  // but every end is representable and must be returned.
  it.each`
    value                       | unit       | weekStartsOn | expected
    ${"-271821-04-19T12:00:00"} | ${"day"}   | ${undefined} | ${"-271821-04-19T23:59:59.999999999"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59.999999999"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24T23:59:59.999999999"}
    ${"-271821-04-19T12:00:00"} | ${"month"} | ${undefined} | ${"-271821-04-30T23:59:59.999999999"}
    ${"-271821-04-19T12:00:00"} | ${"year"}  | ${undefined} | ${"-271821-12-31T23:59:59.999999999"}
  `(
    "returns $expected as the $unit end of the first-day value $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, unit, { weekStartsOn })).toBe(expected);
    },
  );
});

// Calendar & zone semantics §3: end = next start − 1 ns, and never before the input. A Temporal
// string without a fraction reads as .000000000 (ParseISODateTime), so a truncated end would name
// next start − 1 s and fall before an input inside the unit's final second. Each `expected` is
// `Temporal.PlainDateTime.from(nextStart).subtract({ nanoseconds: 1 })` on the plain polyfill.
// 2024-03-31 is a Sunday, the last day of a Monday-first week.
describe("endOfDateTime for an input inside the unit's final second", () => {
  it.each`
    value                            | unit             | nextStart                       | expected
    ${"2024-03-31T23:59:59.5"}       | ${"year"}        | ${"2025-01-01T00:00:00"}        | ${"2024-12-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"month"}       | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"week"}        | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"day"}         | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"hour"}        | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"minute"}      | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T23:59:59.5"}       | ${"second"}      | ${"2024-04-01T00:00:00"}        | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-15T14:30:45.123456"}  | ${"millisecond"} | ${"2024-03-15T14:30:45.124"}    | ${"2024-03-15T14:30:45.123999999"}
    ${"2024-03-15T14:30:45.1234567"} | ${"microsecond"} | ${"2024-03-15T14:30:45.123457"} | ${"2024-03-15T14:30:45.123456999"}
  `(
    "returns $expected (next start $nextStart − 1 ns) as the $unit end of $value",
    ({ value, unit, nextStart, expected }) => {
      const end = endOfDateTime(value, unit);

      expect(end).toBe(expected);
      expect(
        Temporal.PlainDateTime.from(end).equals(
          Temporal.PlainDateTime.from(nextStart).subtract({ nanoseconds: 1 }),
        ),
      ).toBe(true);
      expect(Temporal.PlainDateTime.compare(end, value)).toBeGreaterThanOrEqual(
        0,
      );
    },
  );
});
