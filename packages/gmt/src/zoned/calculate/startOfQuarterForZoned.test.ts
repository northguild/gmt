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

  // `disambiguation` and `offset` were removed in 1.16.0: they were ignored, because a quarter
  // boundary is always a real instant and TC39's `startOfDay()` takes neither. Passing one is a type error, and a
  // JavaScript caller's stray property changes nothing.
  it("treats the removed disambiguation option as a type error and ignores it at runtime", () => {
    expect(
      startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", {
        // @ts-expect-error -- `disambiguation` was removed in 1.16.0
        disambiguation: "reject",
      }),
    ).toBe("2024-01-01T00:00:00+00:00[UTC]");
  });
  it("treats the removed offset option as a type error and ignores it at runtime", () => {
    expect(
      startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", {
        // @ts-expect-error -- `offset` was removed in 1.16.0
        offset: "reject",
      }),
    ).toBe("2024-01-01T00:00:00+00:00[UTC]");
  });
});

// The quarter starts at the real local bucket of its first month, and every wall-clock field
// below it is reset — including the
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
    ${"2024-11-03T00:30:00-05:00[America/Havana]"}    | ${"2024-10-01T00:00:00-04:00[America/Havana]"}    | ${"the second pass of Havana's repeated midnight stays in Q4"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(startOfQuarterForZoned(value)).toBe(expected);
  });
});

// An explicit fractionalSecondDigits still resets the sub-second fields: the quarter starts at local
// midnight, not at midnight plus the input's milliseconds.
describe("startOfQuarterForZoned sub-second reset with explicit options", () => {
  it.each`
    value                                   | options                          | expected
    ${"2024-05-15T12:34:56.789+00:00[UTC]"} | ${{ fractionalSecondDigits: 3 }} | ${"2024-04-01T00:00:00.000+00:00[UTC]"}
  `(
    "returns $expected for $value with $options",
    ({ value, options, expected }) => {
      expect(startOfQuarterForZoned(value, options)).toBe(expected);
    },
  );
});

// The last representable instant is +275760-09-13T00:00:00Z (Santiago 09-12T21:00-03:00). Q3 starts
// at local midnight on 1 July, on Santiago's winter offset (-04:00); no transition falls on that day.
// Sydney's max is +275760-09-13T10:00+10:00; its Q3 also starts on 1 July at +10:00 (standard time).
describe("startOfQuarterForZoned at the maximum instant in a DST zone", () => {
  it.each`
    value                                               | expected
    ${"+275760-09-12T21:00:00-03:00[America/Santiago]"} | ${"+275760-07-01T00:00:00-04:00[America/Santiago]"}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${"+275760-07-01T00:00:00+10:00[Australia/Sydney]"}
  `(
    "returns $expected as the quarter start of $value",
    ({ value, expected }) => {
      expect(startOfQuarterForZoned(value)).toBe(expected);
    },
  );
});
