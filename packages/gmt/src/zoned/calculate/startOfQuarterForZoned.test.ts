import { startOfQuarterForZoned } from "./startOfQuarterForZoned";

describe("startOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(startOfQuarterForZoned(value)).toBe(expected);
  });

  it.each`
    fractionalSecondDigits | value                         | expected
    ${0}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${3}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000+00:00[UTC]"}
    ${6}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000000+00:00[UTC]"}
    ${9}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000000000+00:00[UTC]"}
  `(
    "returns $expected for $value with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, fractionalSecondDigits, expected }) => {
      expect(startOfQuarterForZoned(value, { fractionalSecondDigits })).toBe(
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
      expect(startOfQuarterForZoned(invalidZoned)).toBe("");
    },
  );

  // disambiguation + offset are wired through, though quarter starts (Jan1/Apr1/Jul1/Oct1) rarely
  // coincide with a DST transition in common IANA zones — this verifies the parameters are accepted
  // and don't change output for the common case (mechanism verification, not a gap/overlap case)
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter start",
    ({ disambiguation, offset }) => {
      const optionsArg =
        offset === undefined ? { disambiguation } : { disambiguation, offset };
      expect(
        startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", optionsArg),
      ).toBe("2024-01-01T00:00:00+00:00[UTC]");
    },
  );
});

// With neither `disambiguation` nor `offset` passed, the quarter starts at the real local
// bucket of its first month, and every wall-clock field below it is reset — including the
// milliseconds, microseconds and nanoseconds the input carried. Expected values verified
// against `bucketRange` month buckets on @js-temporal/polyfill@0.5.1.
describe("startOfQuarterForZoned with default options", () => {
  it.each`
    value                                         | fractionalSecondDigits | expected
    ${"2024-05-15T12:34:56.789+00:00[UTC]"}       | ${undefined}           | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-05-15T12:34:56.789+00:00[UTC]"}       | ${3}                   | ${"2024-04-01T00:00:00.000+00:00[UTC]"}
    ${"2024-05-15T12:34:56.123456789+00:00[UTC]"} | ${9}                   | ${"2024-04-01T00:00:00.000000000+00:00[UTC]"}
  `(
    "resets sub-second fields of $value to $expected with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, fractionalSecondDigits, expected }) => {
      expect(startOfQuarterForZoned(value, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  it.each`
    value                                             | expected                                          | description
    ${"1978-10-01T00:30:00+01:00[Africa/Tunis]"}      | ${"1978-10-01T00:00:00+02:00[Africa/Tunis]"}      | ${"Tunis repeated Q4's first local hour; the second pass still belongs to Q4's first October bucket"}
    ${"1982-02-15T12:00:00+08:00[Asia/Kuala_Lumpur]"} | ${"1982-01-01T00:00:00+08:00[Asia/Kuala_Lumpur]"} | ${"Kuala Lumpur skipped 23:30 → 00:00 into Q1"}
    ${"2010-09-30T23:30:00+02:00[Africa/Cairo]"}      | ${"2010-07-01T00:00:00+03:00[Africa/Cairo]"}      | ${"Cairo repeated Q3's last local hour"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(startOfQuarterForZoned(value)).toBe(expected);
  });
});

// Opting into wall-clock resolution still resets the sub-second fields: the quarter starts at
// local midnight, not at midnight plus the input's milliseconds.
describe("startOfQuarterForZoned sub-second reset with explicit options", () => {
  it.each`
    value                                   | options                                                        | expected
    ${"2024-05-15T12:34:56.789+00:00[UTC]"} | ${{ disambiguation: "compatible", fractionalSecondDigits: 3 }} | ${"2024-04-01T00:00:00.000+00:00[UTC]"}
    ${"2024-05-15T12:34:56.789+00:00[UTC]"} | ${{ offset: "prefer", fractionalSecondDigits: 3 }}             | ${"2024-04-01T00:00:00.000+00:00[UTC]"}
  `(
    "returns $expected for $value with $options",
    ({ value, options, expected }) => {
      expect(startOfQuarterForZoned(value, options)).toBe(expected);
    },
  );
});

// The explicit path at a transition is unchanged wall-clock `.with()`: Tunis repeated Q4's first
// local hour on 1978-10-01, so "later" resolves 00:00 to the second pass (+01:00) where the
// default path and "compatible" give the quarter's first real instant (+02:00). Verified on
// @js-temporal/polyfill@0.5.1.
describe("startOfQuarterForZoned at a zone transition with explicit options", () => {
  it.each`
    options                             | expected
    ${{ disambiguation: "later" }}      | ${"1978-10-01T00:00:00+01:00[Africa/Tunis]"}
    ${{ disambiguation: "compatible" }} | ${"1978-10-01T00:00:00+02:00[Africa/Tunis]"}
  `(
    "returns $expected for Tunis's repeated Q4 first hour with $options",
    ({ options, expected }) => {
      expect(
        startOfQuarterForZoned(
          "1978-10-01T00:30:00+01:00[Africa/Tunis]",
          options,
        ),
      ).toBe(expected);
    },
  );
});
