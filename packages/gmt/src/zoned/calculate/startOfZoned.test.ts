import { startOfZoned } from "./startOfZoned";

describe("startOfZoned", () => {
  it.each`
    value                                         | unit             | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"year"}        | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"month"}       | ${"2024-02-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"week"}        | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"day"}         | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"hour"}        | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"minute"}      | ${"2024-02-29T12:34:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"second"}      | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999+00:00[UTC]"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999+00:00[UTC]"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999999+00:00[UTC]"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999+00:00[UTC]"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );

  // supports weekStartsOn option
  it.each`
    value                               | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${undefined} | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                                         | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123+00:00[UTC]"}    | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123456+00:00[UTC]"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.000000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${undefined}           | ${"2024-02-29T12:34:56+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(startOfZoned(value, unit, { fractionalSecondDigits })).toBe(
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
      expect(startOfZoned(invalidZonedDateTime, "month")).toBe("");
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
    expect(startOfZoned("2024-02-29T12:34:56+00:00[UTC]", invalidUnit)).toBe(
      "",
    );
  });

  // disambiguation: fall-back overlap — source sits in the second, repeated 1am
  it.each`
    value                                            | disambiguation  | expected
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:00:00-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:00:00-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:00:00-04:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
    ${"2024-11-03T01:45:00-05:00[America/New_York]"} | ${"reject"}     | ${""}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${undefined}    | ${"2024-10-27T02:00:00+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"compatible"} | ${"2024-10-27T02:00:00+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"earlier"}    | ${"2024-10-27T02:00:00+02:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"later"}      | ${"2024-10-27T02:00:00+01:00[Europe/Berlin]"}
    ${"2024-10-27T02:45:00+01:00[Europe/Berlin]"}    | ${"reject"}     | ${""}
  `(
    "resolves fall-back overlap $value with disambiguation $disambiguation to $expected for unit hour",
    ({ value, disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(startOfZoned(value, "hour", optionsArg)).toBe(expected);
    },
  );

  it("disambiguation values produce genuinely different output on a fall-back overlap when offset defaults to ignore (regression guard against offset:prefer silently no-opping disambiguation)", () => {
    const value = "2024-11-03T01:45:00-05:00[America/New_York]";
    const compatible = startOfZoned(value, "hour", {
      disambiguation: "compatible",
    });
    const later = startOfZoned(value, "hour", { disambiguation: "later" });
    const rejected = startOfZoned(value, "hour", { disambiguation: "reject" });

    expect(compatible).not.toBe(later);
    expect(rejected).toBe("");
  });

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${""}
    ${"ignore"}  | ${""}
    ${"prefer"}  | ${"2024-11-03T01:00:00-05:00[America/New_York]"}
  `(
    "with disambiguation reject and offset $offset, returns $expected",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { disambiguation: "reject" as const }
          : { disambiguation: "reject" as const, offset };
      expect(
        startOfZoned(
          "2024-11-03T01:45:00-05:00[America/New_York]",
          "hour",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );

  // disambiguation: local midnight itself is a DST gap (America/Sao_Paulo jumped 00:00 -> 01:00 on 2018-11-04),
  // so the "day" time-reset must honor disambiguation, not silently advance past the gap via withPlainTime()
  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"compatible"} | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"later"}      | ${"2018-11-04T01:00:00-02:00[America/Sao_Paulo]"}
    ${"reject"}     | ${""}
  `(
    "resolves spring-forward gap at local midnight for unit day with disambiguation $disambiguation to $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(
        startOfZoned(
          "2018-11-04T12:00:00-02:00[America/Sao_Paulo]",
          "day",
          optionsArg,
        ),
      ).toBe(expected);
    },
  );

  // disambiguation: week-start day-of-week subtraction can land on a DST gap even when the
  // anchor's own local time is not the transition (America/Sao_Paulo, week starting Sunday,
  // lands on Sunday 2018-11-04's midnight gap when subtracting from a later day in that week)
  it("resolves spring-forward gap in the week-start boundary with disambiguation reject", () => {
    expect(
      startOfZoned("2018-11-06T12:00:00-02:00[America/Sao_Paulo]", "week", {
        weekStartsOn: "sunday",
        disambiguation: "reject",
      }),
    ).toBe("");
  });

  // disambiguation has no effect on a spring-forward gap when the source itself was constructed via a valid pre/post-transition offset (arithmetic/field-set already lands on a valid instant)
  it.each`
    disambiguation
    ${"compatible"}
    ${"earlier"}
    ${"later"}
    ${"reject"}
  `(
    "returns the same start-of-day result regardless of disambiguation $disambiguation when no boundary jump crosses a transition",
    ({ disambiguation }) => {
      expect(
        startOfZoned("2024-03-10T12:00:00-04:00[America/New_York]", "day", {
          disambiguation,
        }),
      ).toBe("2024-03-10T00:00:00-05:00[America/New_York]");
    },
  );
});
