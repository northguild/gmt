import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { roundDateTime } from "./roundDateTime";

describe("roundDateTime", () => {
  // date units: year, month, week (manual rounding)
  it.each`
    value                    | unit       | expected
    ${"2024-06-15T12:34:56"} | ${"year"}  | ${"2024-01-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"week"}  | ${"2024-06-17T00:00:00"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // time units: day, hour, minute, second (Temporal.PlainDateTime.round)
  it.each`
    value                    | unit        | expected
    ${"2024-06-15T12:34:56"} | ${"day"}    | ${"2024-06-16T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"hour"}   | ${"2024-06-15T13:00:00"}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${"2024-06-15T12:35:00"}
    ${"2024-06-15T12:34:56"} | ${"second"} | ${"2024-06-15T12:34:56"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // sub-second units with precision
  it.each`
    value                              | unit             | expected
    ${"2024-06-15T12:34:56.789"}       | ${"millisecond"} | ${"2024-06-15T12:34:56.789"}
    ${"2024-06-15T12:34:56.789123"}    | ${"microsecond"} | ${"2024-06-15T12:34:56.789123"}
    ${"2024-06-15T12:34:56.789123456"} | ${"nanosecond"}  | ${"2024-06-15T12:34:56.789123456"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // rounding modes for date units
  it.each`
    value                    | unit       | roundingMode    | expected
    ${"2024-02-15T12:34:56"} | ${"month"} | ${"floor"}      | ${"2024-02-01T00:00:00"}
    ${"2024-02-15T12:34:56"} | ${"month"} | ${"ceil"}       | ${"2024-03-01T00:00:00"}
    ${"2024-02-15T12:34:56"} | ${"month"} | ${"expand"}     | ${"2024-03-01T00:00:00"}
    ${"2024-02-15T12:34:56"} | ${"month"} | ${"trunc"}      | ${"2024-02-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"halfExpand"} | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"halfCeil"}   | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"halfTrunc"}  | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"halfFloor"}  | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"month"} | ${"halfEven"}   | ${"2024-06-01T00:00:00"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // rounding modes for time units
  it.each`
    value                    | unit        | roundingMode | expected
    ${"2024-06-15T12:34:56"} | ${"hour"}   | ${"floor"}   | ${"2024-06-15T12:00:00"}
    ${"2024-06-15T12:34:56"} | ${"hour"}   | ${"ceil"}    | ${"2024-06-15T13:00:00"}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${"floor"}   | ${"2024-06-15T12:34:00"}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${"ceil"}    | ${"2024-06-15T12:35:00"}
    ${"2024-06-15T12:34:56"} | ${"day"}    | ${"ceil"}    | ${"2024-06-16T00:00:00"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // rounding increments for time units
  it.each`
    value                    | unit        | roundingIncrement | expected
    ${"2024-06-15T12:34:56"} | ${"hour"}   | ${2}              | ${"2024-06-15T12:00:00"}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${15}             | ${"2024-06-15T12:30:00"}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${30}             | ${"2024-06-15T12:30:00"}
  `(
    "returns $expected for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(
        roundDateTime(value, { smallestUnit: unit, roundingIncrement }),
      ).toBe(expected);
    },
  );

  // zero and negative roundingIncrement return ""
  it.each`
    value                    | unit        | roundingIncrement
    ${"2024-06-15T12:34:56"} | ${"hour"}   | ${0}
    ${"2024-06-15T12:34:56"} | ${"minute"} | ${-1}
    ${"2024-06-15T12:34:56"} | ${"day"}    | ${0}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundDateTime(value, { smallestUnit: unit, roundingIncrement }),
      ).toBe("");
    },
  );

  // exact half-boundary for date units
  it.each`
    value                    | unit       | roundingMode    | expected
    ${"2024-06-16T12:34:56"} | ${"month"} | ${"halfExpand"} | ${"2024-07-01T00:00:00"}
    ${"2024-06-16T12:34:56"} | ${"month"} | ${"halfCeil"}   | ${"2024-07-01T00:00:00"}
    ${"2024-06-16T12:34:56"} | ${"month"} | ${"halfTrunc"}  | ${"2024-07-01T00:00:00"}
    ${"2024-06-16T12:34:56"} | ${"month"} | ${"halfFloor"}  | ${"2024-07-01T00:00:00"}
  `(
    "returns $expected for half-boundary $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // leap day edge case
  it.each`
    value                    | unit       | roundingMode    | expected
    ${"2024-02-29T12:34:56"} | ${"month"} | ${"halfExpand"} | ${"2024-03-01T00:00:00"}
    ${"2024-02-29T12:34:56"} | ${"year"}  | ${"halfExpand"} | ${"2024-01-01T00:00:00"}
  `(
    "returns $expected for leap day $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // invalid datetime values
  it.each`
    invalidDateTime
    ${"invalid"}
    ${"2024-02-30T12:34:56"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T23:59:60"}
    ${"2024-02-29T12:34:56Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid datetime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(roundDateTime(invalidDateTime, { smallestUnit: "hour" })).toBe("");
    },
  );

  // invalid unit values
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"hours"}
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      roundDateTime("2024-06-15T12:34:56", {
        smallestUnit: invalidUnit as never,
      }),
    ).toBe("");
  });

  // error path: Temporal.PlainDateTime.from throws
  it("returns empty string when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hour" })).toBe(
      "",
    );
  });
});
