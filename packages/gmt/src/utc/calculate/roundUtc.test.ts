import { roundUtc } from "./roundUtc";

describe("roundUtc", () => {
  // happy path: all supported time units with default rounding
  it.each`
    value                               | unit             | expected
    ${"2024-06-15T12:34:56Z"}           | ${"hour"}        | ${"2024-06-15T13:00:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"minute"}      | ${"2024-06-15T12:35:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"second"}      | ${"2024-06-15T12:34:56Z"}
    ${"2024-06-15T12:34:56.789Z"}       | ${"millisecond"} | ${"2024-06-15T12:34:56.789Z"}
    ${"2024-06-15T12:34:56.789123Z"}    | ${"microsecond"} | ${"2024-06-15T12:34:56.789123Z"}
    ${"2024-06-15T12:34:56.789123456Z"} | ${"nanosecond"}  | ${"2024-06-15T12:34:56.789123456Z"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundUtc(value, { smallestUnit: unit as never })).toBe(expected);
    },
  );

  // rounding modes
  it.each`
    value                               | unit             | roundingMode | expected
    ${"2024-06-15T12:34:56Z"}           | ${"hour"}        | ${"floor"}   | ${"2024-06-15T12:00:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"hour"}        | ${"ceil"}    | ${"2024-06-15T13:00:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"hour"}        | ${"expand"}  | ${"2024-06-15T13:00:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"hour"}        | ${"trunc"}   | ${"2024-06-15T12:00:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"minute"}      | ${"floor"}   | ${"2024-06-15T12:34:00Z"}
    ${"2024-06-15T12:34:56Z"}           | ${"minute"}      | ${"ceil"}    | ${"2024-06-15T12:35:00Z"}
    ${"2024-06-15T12:34:56.789Z"}       | ${"second"}      | ${"floor"}   | ${"2024-06-15T12:34:56Z"}
    ${"2024-06-15T12:34:56.789Z"}       | ${"second"}      | ${"ceil"}    | ${"2024-06-15T12:34:57Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"floor"}   | ${"2024-06-15T12:34:56.123Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"ceil"}    | ${"2024-06-15T12:34:56.124Z"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingMode }),
      ).toBe(expected);
    },
  );

  // rounding increments
  it.each`
    value                     | unit        | roundingIncrement | expected
    ${"2024-06-15T12:34:56Z"} | ${"minute"} | ${15}             | ${"2024-06-15T12:30:00Z"}
    ${"2024-06-15T12:34:56Z"} | ${"minute"} | ${30}             | ${"2024-06-15T12:30:00Z"}
    ${"2024-06-15T12:34:56Z"} | ${"hour"}   | ${2}              | ${"2024-06-15T12:00:00Z"}
    ${"2024-06-15T23:59:59Z"} | ${"hour"}   | ${2}              | ${"2024-06-16T00:00:00Z"}
  `(
    "returns $expected for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingIncrement }),
      ).toBe(expected);
    },
  );

  // zero and negative roundingIncrement return ""
  it.each`
    value                     | unit        | roundingIncrement
    ${"2024-06-15T12:34:56Z"} | ${"minute"} | ${0}
    ${"2024-06-15T12:34:56Z"} | ${"hour"}   | ${-1}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingIncrement }),
      ).toBe("");
    },
  );

  // custom fractionalSecondDigits
  it.each`
    value                               | unit             | fractionalSecondDigits | expected
    ${"2024-06-15T12:34:56.789123Z"}    | ${"millisecond"} | ${0}                   | ${"2024-06-15T12:34:56Z"}
    ${"2024-06-15T12:34:56.789123Z"}    | ${"millisecond"} | ${3}                   | ${"2024-06-15T12:34:56.789Z"}
    ${"2024-06-15T12:34:56.789123Z"}    | ${"microsecond"} | ${3}                   | ${"2024-06-15T12:34:56.789Z"}
    ${"2024-06-15T12:34:56.789123456Z"} | ${"nanosecond"}  | ${6}                   | ${"2024-06-15T12:34:56.789123Z"}
  `(
    "returns $expected for $value with fractionalSecondDigits $fractionalSecondDigits on $unit",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(
        roundUtc(value, {
          smallestUnit: unit as never,
          fractionalSecondDigits,
        }),
      ).toBe(expected);
    },
  );

  // exact half-boundary and boundary cases
  it.each`
    value                               | unit             | roundingMode    | expected
    ${"2024-06-15T12:30:00Z"}           | ${"minute"}      | ${"halfExpand"} | ${"2024-06-15T12:30:00Z"}
    ${"2024-06-15T12:30:00Z"}           | ${"minute"}      | ${"halfTrunc"}  | ${"2024-06-15T12:30:00Z"}
    ${"00:00:00Z"}                      | ${"hour"}        | ${"halfExpand"} | ${""}
    ${"23:59:59Z"}                      | ${"hour"}        | ${"halfExpand"} | ${""}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"halfExpand"} | ${"2024-06-15T12:34:56.123Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"halfCeil"}   | ${"2024-06-15T12:34:56.123Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"halfTrunc"}  | ${"2024-06-15T12:34:56.123Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"millisecond"} | ${"halfFloor"}  | ${"2024-06-15T12:34:56.123Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"microsecond"} | ${"halfExpand"} | ${"2024-06-15T12:34:56.123457Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"microsecond"} | ${"halfCeil"}   | ${"2024-06-15T12:34:56.123457Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"microsecond"} | ${"halfTrunc"}  | ${"2024-06-15T12:34:56.123457Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"microsecond"} | ${"halfFloor"}  | ${"2024-06-15T12:34:56.123457Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"microsecond"} | ${"halfEven"}   | ${"2024-06-15T12:34:56.123457Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"nanosecond"}  | ${"halfExpand"} | ${"2024-06-15T12:34:56.123456789Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"nanosecond"}  | ${"halfCeil"}   | ${"2024-06-15T12:34:56.123456789Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"nanosecond"}  | ${"halfTrunc"}  | ${"2024-06-15T12:34:56.123456789Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"nanosecond"}  | ${"halfFloor"}  | ${"2024-06-15T12:34:56.123456789Z"}
    ${"2024-06-15T12:34:56.123456789Z"} | ${"nanosecond"}  | ${"halfEven"}   | ${"2024-06-15T12:34:56.123456789Z"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingMode }),
      ).toBe(expected);
    },
  );

  // invalid inputs
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
      expect(
        roundUtc(invalidValue as never, { smallestUnit: "hour" as never }),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      roundUtc("2024-06-15T12:34:56Z", { smallestUnit: invalidUnit as never }),
    ).toBe("");
  });

  // unsupported date units (year, month, week, day) return ""
  it.each`
    unit
    ${"year"}
    ${"month"}
    ${"week"}
    ${"day"}
  `("returns empty string for unsupported date unit $unit", ({ unit }) => {
    expect(
      roundUtc("2024-06-15T12:34:56Z", { smallestUnit: unit as never }),
    ).toBe("");
  });

  // leap second handling
  it.each`
    value                     | unit        | expected
    ${"2024-12-31T23:59:60Z"} | ${"second"} | ${""}
  `("returns $expected for leap second $value", ({ value, unit, expected }) => {
    expect(roundUtc(value, { smallestUnit: unit as never })).toBe(expected);
  });

  // negative timestamps (dates before epoch)
  it.each`
    value                     | unit      | expected
    ${"1969-12-31T23:00:00Z"} | ${"hour"} | ${"1969-12-31T23:00:00Z"}
    ${"1969-12-31T23:34:56Z"} | ${"hour"} | ${"1970-01-01T00:00:00Z"}
  `(
    "returns $expected for negative timestamp $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundUtc(value, { smallestUnit: unit as never })).toBe(expected);
    },
  );
});
