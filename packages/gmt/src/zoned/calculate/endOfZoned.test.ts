import { endOfZoned } from "./endOfZoned";

describe("endOfZoned", () => {
  it.each`
    value                                         | unit             | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"year"}        | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"month"}       | ${"2024-02-29T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"week"}        | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"day"}         | ${"2024-02-29T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"hour"}        | ${"2024-02-29T12:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"minute"}      | ${"2024-02-29T12:34:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123+00:00[UTC]"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.123+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456+00:00[UTC]"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.123456+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.123456789+00:00[UTC]"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfZoned(value, unit)).toBe(expected);
    },
  );

  // supports weekStartsOn option
  it.each`
    value                               | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${undefined} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59+00:00[UTC]"}
  `(
    "supports weekStartOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                                         | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.123456789+00:00[UTC]"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.999999999+00:00[UTC]"}
  `(
    "supports fractionalSecondDigits $fractionalSecondDigits returning $expected for $value and $unit",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfZoned(value, unit, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  // invalid value
  it.each`
    invalidZonedDateTime
    ${"invalid-zoned-datetime"}
    ${"2024-02-30T12:34:56+00:00[UTC]"}
    ${"2024-02-29T24:00:00+00:00[UTC]"}
    ${"2024-02-29T12:60:00+00:00[UTC]"}
    ${"2024-02-29T12:34:60+00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid zoned datetime $invalidZonedDateTime",
    ({ invalidZonedDateTime }) => {
      expect(endOfZoned(invalidZonedDateTime, "month")).toBe("");
    },
  );

  // invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfZoned("2024-02-29T12:34:56+00:00[UTC]", invalidUnit)).toBe("");
  });

  // disambiguation: fall-back overlap — source sits in the second, repeated 1am
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:59:59-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:59:59-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:59:59-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:59:59-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"reject"}     | ${""}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:59:59+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:59:59+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:59:59+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:59:59+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap $value with disambiguation $disambiguation to $expected for unit hour",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(endOfZoned(value, "hour", optionsArg)).toBe(expected);
    },
  );

  it("disambiguation values produce genuinely different output on a fall-back overlap when offset defaults to ignore (regression guard against offset:prefer silently no-opping disambiguation)", () => {
    const value = "2024-11-03T01:45:00-05:00[America/New_York]";
    const compatible = endOfZoned(value, "hour", {
      disambiguation: "compatible",
    });
    const later = endOfZoned(value, "hour", { disambiguation: "later" });
    const rejected = endOfZoned(value, "hour", { disambiguation: "reject" });

    expect(compatible).not.toBe(later);
    expect(rejected).toBe("");
  });

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${""}
    ${"ignore"}  | ${""}
    ${"prefer"}  | ${"2024-11-03T01:59:59-05:00[America/New_York]"}
  `(
    "with disambiguation reject and offset $offset, returns $expected",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(
        endOfZoned(
          "2024-11-03T01:15:00-05:00[America/New_York]",
          "hour",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );
});
