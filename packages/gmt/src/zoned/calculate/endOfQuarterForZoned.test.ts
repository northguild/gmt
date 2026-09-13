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

  // The deprecated `disambiguation`/`offset` are accepted and ignored: an ordinary quarter end is
  // unchanged by any value, "reject" included.
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

// The quarter ends one nanosecond before the
// next quarter's first local month bucket, so it is never before the input. Expected values
// verified against `bucketRange` month buckets on @js-temporal/polyfill@0.5.1.
describe("endOfQuarterForZoned with default options", () => {
  it.each`
    value                                          | expected                                       | description
    ${"2010-09-30T23:30:00+02:00[Africa/Cairo]"}   | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}   | ${"Cairo repeated Q3's last local hour; the second pass is the later one"}
    ${"2010-09-30T23:30:00+03:00[Africa/Cairo]"}   | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}   | ${"the first pass sits in the same September bucket"}
    ${"1978-09-15T12:00:00+02:00[Africa/Tunis]"}   | ${"1978-09-30T23:59:59+02:00[Africa/Tunis]"}   | ${"Tunis Q3, ending before Q4's repeated first hour"}
    ${"1978-10-01T00:30:00+02:00[Africa/Tunis]"}   | ${"1978-12-31T23:59:59+01:00[Africa/Tunis]"}   | ${"Tunis Q4 from the first pass of its repeated first hour"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"} | ${"2024-12-31T23:59:59-05:00[America/Havana]"} | ${"Havana Q4 from the first pass of its repeated midnight"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });
});

// Cairo repeated Q3's last local hour on 2010-09-30. The quarter ends on the second pass
// (+02:00), one nanosecond before Q4's `startOfDay()`; the deprecated `disambiguation`/`offset`
// are ignored, so "compatible" no longer ends it on the first pass, before the input. Verified on
// @js-temporal/polyfill@0.5.1.
describe("endOfQuarterForZoned at a zone transition with ignored explicit options", () => {
  it.each`
    options                                           | expected
    ${{ disambiguation: "compatible" }}               | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}
    ${{ disambiguation: "later" }}                    | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}
    ${{ disambiguation: "reject", offset: "reject" }} | ${"2010-09-30T23:59:59+02:00[Africa/Cairo]"}
  `(
    "returns the real quarter end $expected for Cairo's repeated Q3 last hour with ignored $options",
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
