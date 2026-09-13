import { endOfQuarterForZoned } from "./endOfQuarterForZoned";

describe("endOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
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

  // disambiguation + offset are wired through, though quarter boundaries (Mar31/Jun30/Sep30/Dec31
  // end-of-day) rarely coincide with a DST transition in common IANA zones — this verifies the
  // parameters are accepted and don't change output for the common case
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter end",
    ({ disambiguation, offset }) => {
      const optionsArg =
        offset === undefined ? { disambiguation } : { disambiguation, offset };
      expect(
        endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", optionsArg),
      ).toBe("2024-03-31T23:59:59+00:00[UTC]");
    },
  );
});

// With neither `disambiguation` nor `offset` passed, the quarter ends one nanosecond before the
// next quarter's first local month bucket, so it is never before the input. Expected values
// verified against `bucketRange` month buckets on @js-temporal/polyfill@0.5.1.
describe("endOfQuarterForZoned with default options", () => {
  it.each`
    value                                        | expected                                     | description
    ${"2010-09-30T23:30:00+02:00[Africa/Cairo]"} | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"} | ${"Cairo repeated Q3's last local hour; the second pass is the later one"}
    ${"2010-09-30T23:30:00+03:00[Africa/Cairo]"} | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"} | ${"the first pass sits in the same September bucket"}
    ${"1978-09-15T12:00:00+02:00[Africa/Tunis]"} | ${"1978-09-30T23:59:59+02:00[Africa/Tunis]"} | ${"Tunis Q3, ending before Q4's repeated first hour"}
    ${"1978-10-01T00:30:00+02:00[Africa/Tunis]"} | ${"1978-12-31T23:59:59+01:00[Africa/Tunis]"} | ${"Tunis Q4 from the first pass of its repeated first hour"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });
});

// The explicit path at a transition is unchanged wall-clock `.with()`: Cairo repeated Q3's last
// local hour, and "compatible" resolves 23:59:59 to the first pass (+03:00) — before an input on
// the second pass — where the default path and "later" end on the second pass (+02:00).
// Verified on @js-temporal/polyfill@0.5.1.
describe("endOfQuarterForZoned at a zone transition with explicit options", () => {
  it.each`
    options                             | expected
    ${{ disambiguation: "compatible" }} | ${"2010-09-30T23:59:59+03:00[Africa/Cairo]"}
    ${{ disambiguation: "later" }}      | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}
  `(
    "returns $expected for Cairo's repeated Q3 last hour with $options",
    ({ options, expected }) => {
      expect(
        endOfQuarterForZoned(
          "2010-09-30T23:30:00+02:00[Africa/Cairo]",
          options,
        ),
      ).toBe(expected);
    },
  );
});
