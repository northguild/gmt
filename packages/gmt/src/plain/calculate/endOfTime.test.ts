import { Temporal } from "@js-temporal/polyfill";
import { endOfTime } from "./endOfTime";

describe("endOfTime", () => {
  it.each`
    value                   | unit             | expected
    ${"12:34:56"}           | ${"day"}         | ${"23:59:59.999999999"}
    ${"12:34:56"}           | ${"hour"}        | ${"12:59:59.999999999"}
    ${"12:34:56"}           | ${"minute"}      | ${"12:34:59.999999999"}
    ${"12:34:56"}           | ${"second"}      | ${"12:34:56.999999999"}
    ${"12:34:56.999"}       | ${"millisecond"} | ${"12:34:56.999999999"}
    ${"12:34:56.999999"}    | ${"microsecond"} | ${"12:34:56.999999999"}
    ${"12:34:56.999999999"} | ${"nanosecond"}  | ${"12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(endOfTime(value, unit)).toBe(expected);
  });

  it.each`
    value                   | unit        | fractionalSecondDigits | expected
    ${"12:34:56.123456789"} | ${"second"} | ${0}                   | ${"12:34:56"}
    ${"12:34:56.123456789"} | ${"second"} | ${3}                   | ${"12:34:56.999"}
    ${"12:34:56.123456789"} | ${"second"} | ${6}                   | ${"12:34:56.999999"}
    ${"12:34:56.123456789"} | ${"second"} | ${9}                   | ${"12:34:56.999999999"}
  `(
    "returns $expected for $value, $unit, fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfTime(value, unit, { fractionalSecondDigits })).toBe(expected);
    },
  );

  it.each`
    nonStringInput
    ${"invalid-time"}
    ${"24:34:56.1234567890"}
    ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(endOfTime(nonStringInput, "hour")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"minutez"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfTime("12:34:56", invalidUnit as never)).toBe("");
  });
});

// Calendar & zone semantics §3: end = next start − 1 ns, and never before the input. A Temporal
// string without a fraction reads as .000000000 (ParseISODateTime), so a truncated end would name
// next start − 1 s and fall before an input inside the unit's final second. Each `expected` is
// `Temporal.PlainTime.from(nextStart).subtract({ nanoseconds: 1 })` on the plain polyfill; the day's
// next start is the following midnight, and PlainTime arithmetic wraps 00:00 − 1 ns to 23:59:59.999999999.
describe("endOfTime for an input inside the unit's final second", () => {
  it.each`
    value                 | unit             | nextStart            | expected
    ${"23:59:59.5"}       | ${"day"}         | ${"00:00:00"}        | ${"23:59:59.999999999"}
    ${"12:59:59.5"}       | ${"hour"}        | ${"13:00:00"}        | ${"12:59:59.999999999"}
    ${"12:34:59.5"}       | ${"minute"}      | ${"12:35:00"}        | ${"12:34:59.999999999"}
    ${"12:34:56.5"}       | ${"second"}      | ${"12:34:57"}        | ${"12:34:56.999999999"}
    ${"12:34:56.123456"}  | ${"millisecond"} | ${"12:34:56.124"}    | ${"12:34:56.123999999"}
    ${"12:34:56.1234567"} | ${"microsecond"} | ${"12:34:56.123457"} | ${"12:34:56.123456999"}
  `(
    "returns $expected (next start $nextStart − 1 ns) as the $unit end of $value",
    ({ value, unit, nextStart, expected }) => {
      const end = endOfTime(value, unit);

      expect(end).toBe(expected);
      expect(
        Temporal.PlainTime.from(end).equals(
          Temporal.PlainTime.from(nextStart).subtract({ nanoseconds: 1 }),
        ),
      ).toBe(true);
      expect(Temporal.PlainTime.compare(end, value)).toBeGreaterThanOrEqual(0);
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"days"}         | ${"23:59:59.999999999"}
    ${"hours"}        | ${"13:59:59.999999999"}
    ${"minutes"}      | ${"13:45:59.999999999"}
    ${"seconds"}      | ${"13:45:30.999999999"}
    ${"milliseconds"} | ${"13:45:30.123999999"}
    ${"microseconds"} | ${"13:45:30.123456999"}
    ${"nanoseconds"}  | ${"13:45:30.123456789"}
  `(
    "returns $expected for plural unit $unit on 13:45:30.123456789",
    ({ unit, expected }) => {
      expect(endOfTime("13:45:30.123456789", unit)).toBe(expected);
    },
  );
});
