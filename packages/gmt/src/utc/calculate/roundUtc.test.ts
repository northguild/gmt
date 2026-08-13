import { roundUtc } from "./roundUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("roundUtc", () => {
  // Override: specific times chosen to exercise rounding at sub-unit boundaries
  const hourMinuteInput = "2024-06-15T12:34:56Z";
  const subMsInput = "2024-06-15T12:34:56.789123456Z";

  it.each`
    value                               | unit             | expected
    ${hourMinuteInput}                  | ${"hour"}        | ${"2024-06-15T13:00:00Z"}
    ${hourMinuteInput}                  | ${"minute"}      | ${"2024-06-15T12:35:00Z"}
    ${hourMinuteInput}                  | ${"second"}      | ${"2024-06-15T12:34:56Z"}
    ${"2024-06-15T12:34:56.789Z"}       | ${"millisecond"} | ${"2024-06-15T12:34:56.789Z"}
    ${"2024-06-15T12:34:56.789123Z"}    | ${"microsecond"} | ${"2024-06-15T12:34:56.789123Z"}
    ${"2024-06-15T12:34:56.789123456Z"} | ${"nanosecond"}  | ${"2024-06-15T12:34:56.789123456Z"}
  `(
    "returns $expected for $value rounded to $unit with default rounding",
    ({ value, unit, expected }) => {
      expect(roundUtc(value, { smallestUnit: unit as never })).toBe(expected);
    },
  );

  it.each`
    value                         | unit             | roundingMode | expected
    ${hourMinuteInput}            | ${"hour"}        | ${"floor"}   | ${"2024-06-15T12:00:00Z"}
    ${hourMinuteInput}            | ${"hour"}        | ${"ceil"}    | ${"2024-06-15T13:00:00Z"}
    ${hourMinuteInput}            | ${"hour"}        | ${"expand"}  | ${"2024-06-15T13:00:00Z"}
    ${hourMinuteInput}            | ${"hour"}        | ${"trunc"}   | ${"2024-06-15T12:00:00Z"}
    ${hourMinuteInput}            | ${"minute"}      | ${"floor"}   | ${"2024-06-15T12:34:00Z"}
    ${hourMinuteInput}            | ${"minute"}      | ${"ceil"}    | ${"2024-06-15T12:35:00Z"}
    ${"2024-06-15T12:34:56.789Z"} | ${"second"}      | ${"floor"}   | ${"2024-06-15T12:34:56Z"}
    ${"2024-06-15T12:34:56.789Z"} | ${"second"}      | ${"ceil"}    | ${"2024-06-15T12:34:57Z"}
    ${subMsInput}                 | ${"millisecond"} | ${"floor"}   | ${"2024-06-15T12:34:56.789Z"}
    ${subMsInput}                 | ${"millisecond"} | ${"ceil"}    | ${"2024-06-15T12:34:56.790Z"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    value                     | unit        | roundingIncrement | expected
    ${hourMinuteInput}        | ${"minute"} | ${15}             | ${"2024-06-15T12:30:00Z"}
    ${hourMinuteInput}        | ${"minute"} | ${30}             | ${"2024-06-15T12:30:00Z"}
    ${hourMinuteInput}        | ${"hour"}   | ${2}              | ${"2024-06-15T12:00:00Z"}
    ${"2024-06-15T23:59:59Z"} | ${"hour"}   | ${2}              | ${"2024-06-16T00:00:00Z"}
  `(
    "returns $expected for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingIncrement }),
      ).toBe(expected);
    },
  );

  it.each`
    value              | unit        | roundingIncrement
    ${hourMinuteInput} | ${"minute"} | ${0}
    ${hourMinuteInput} | ${"hour"}   | ${-1}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingIncrement }),
      ).toBe("");
    },
  );

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

  it.each`
    value              | unit             | roundingMode    | expected
    ${hourMinuteInput} | ${"minute"}      | ${"halfExpand"} | ${"2024-06-15T12:35:00Z"}
    ${subMsInput}      | ${"millisecond"} | ${"halfExpand"} | ${"2024-06-15T12:34:56.789Z"}
    ${subMsInput}      | ${"microsecond"} | ${"halfExpand"} | ${"2024-06-15T12:34:56.789123Z"}
    ${subMsInput}      | ${"nanosecond"}  | ${"halfExpand"} | ${"2024-06-15T12:34:56.789123456Z"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit at sub-unit boundary",
    ({ value, unit, roundingMode, expected }) => {
      expect(
        roundUtc(value, { smallestUnit: unit as never, roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-06-15T12:34:56"}
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

  it.each`
    value                     | unit        | expected
    ${"2024-12-31T23:59:60Z"} | ${"second"} | ${""}
  `("returns $expected for leap second $value", ({ value, unit, expected }) => {
    expect(roundUtc(value, { smallestUnit: unit as never })).toBe(expected);
  });

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hour" })).toBe("");
  });
});
