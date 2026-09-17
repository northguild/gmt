import { Temporal } from "@js-temporal/polyfill";
import { endOfQuarterForZoned } from "./endOfQuarterForZoned";

describe("endOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });

  it.each`
    fractionalSecondDigits | value                         | expected
    ${0}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${3}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999+00:00[UTC]"}
    ${6}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999+00:00[UTC]"}
    ${9}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
  `(
    "returns $expected for $value with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, fractionalSecondDigits, expected }) => {
      expect(endOfQuarterForZoned(value, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  it.each`
    invalidZoned
    ${"invalid-zoned"}
    ${"2024-02-30T12:00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid zoned $invalidZoned",
    ({ invalidZoned }) => {
      expect(endOfQuarterForZoned(invalidZoned)).toBe("");
    },
  );

  // `disambiguation` and `offset` were removed in 1.16.0: they were ignored, because a quarter
  // boundary is always a real instant and TC39's `startOfDay()` takes neither. Passing one is a type error, and a
  // JavaScript caller's stray property changes nothing.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", {
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        disambiguation: "reject",
      }),
    ).toBe("2024-03-31T23:59:59.999999999+00:00[UTC]");
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", {
        // @ts-expect-error -- `offset` was removed in 1.16.0
        offset: "reject",
      }),
    ).toBe("2024-03-31T23:59:59.999999999+00:00[UTC]");
  });
});

// The quarter ends one nanosecond before the next quarter's first local day starts, written at
// nanosecond precision, so it is never before the input. Each expected value is `startOfDay()` of
// the next quarter's first date minus 1 ns, checked on @js-temporal/polyfill@0.5.1.
describe("endOfQuarterForZoned with default options", () => {
  it.each`
    value                                          | expected                                                 | description
    ${"2010-09-30T23:30:00+02:00[Africa/Cairo]"}   | ${"2010-09-30T23:59:59.999999999+02:00[Africa/Cairo]"}   | ${"Cairo repeated Q3's last local hour; the second pass is the later one"}
    ${"2010-09-30T23:30:00+03:00[Africa/Cairo]"}   | ${"2010-09-30T23:59:59.999999999+02:00[Africa/Cairo]"}   | ${"the first pass sits in the same September bucket"}
    ${"1978-09-15T12:00:00+02:00[Africa/Tunis]"}   | ${"1978-09-30T23:59:59.999999999+02:00[Africa/Tunis]"}   | ${"Tunis Q3, ending before Q4's repeated first hour"}
    ${"1978-10-01T00:30:00+02:00[Africa/Tunis]"}   | ${"1978-12-31T23:59:59.999999999+01:00[Africa/Tunis]"}   | ${"Tunis Q4 from the first pass of its repeated first hour"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"} | ${"2024-12-31T23:59:59.999999999-05:00[America/Havana]"} | ${"Havana Q4 from the first pass of its repeated midnight"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });
});

// -271821-04-20T00:00:00Z is the first representable instant. Its quarter began on 1 April, before
// the range, but the quarter's end (30 June) is representable and must be returned.
describe("endOfQuarterForZoned at the first representable instant", () => {
  it.each`
    value                                  | expected
    ${"-271821-04-20T12:00:00+00:00[UTC]"} | ${"-271821-06-30T23:59:59.999999999+00:00[UTC]"}
  `("returns $expected as the quarter end of $value", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });
});

// Calendar & zone semantics §3: end = next start − 1 ns, and never before the input. A Temporal
// string without a fraction reads as .000000000 (ParseISODateTime), so a truncated end would name
// next start − 1 s and fall before an input inside the quarter's final second. Each `nextStart` is
// `startOfDay()` of the next quarter's first date; each `expected` is
// `Temporal.ZonedDateTime.from(nextStart).subtract({ nanoseconds: 1 })` on the plain polyfill.
describe("endOfQuarterForZoned for an input inside the quarter's final second", () => {
  it.each`
    value                                             | nextStart                                       | expected                                                  | description
    ${"2024-03-31T23:59:59.5+00:00[UTC]"}             | ${"2024-04-01T00:00:00+00:00[UTC]"}             | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}             | ${"UTC Q1"}
    ${"2010-09-30T23:59:59.5+02:00[Africa/Cairo]"}    | ${"2010-10-01T00:00:00+02:00[Africa/Cairo]"}    | ${"2010-09-30T23:59:59.999999999+02:00[Africa/Cairo]"}    | ${"Cairo's repeated last hour of Q3, second pass"}
    ${"2024-09-30T23:59:59.5+13:45[Pacific/Chatham]"} | ${"2024-10-01T00:00:00+13:45[Pacific/Chatham]"} | ${"2024-09-30T23:59:59.999999999+13:45[Pacific/Chatham]"} | ${"Chatham Q3, after its spring-forward"}
    ${"2024-12-31T23:59:59.5-05:00[America/Havana]"}  | ${"2025-01-01T00:00:00-05:00[America/Havana]"}  | ${"2024-12-31T23:59:59.999999999-05:00[America/Havana]"}  | ${"Havana Q4"}
  `(
    "returns $expected (next start $nextStart − 1 ns) for $value ($description)",
    ({ value, nextStart, expected }) => {
      const end = endOfQuarterForZoned(value);
      const next = Temporal.ZonedDateTime.from(nextStart);

      expect(end).toBe(expected);
      expect(
        Temporal.ZonedDateTime.from(end).equals(
          next.subtract({ nanoseconds: 1 }),
        ),
      ).toBe(true);
      expect(Temporal.ZonedDateTime.compare(end, value)).toBeGreaterThanOrEqual(
        0,
      );
      expect(Temporal.ZonedDateTime.compare(value, next)).toBe(-1);
    },
  );
});
