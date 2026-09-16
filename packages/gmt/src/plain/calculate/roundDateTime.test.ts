import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { roundDateTime } from "./roundDateTime";

describe("roundDateTime", () => {
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

  // Temporal §13.17 GetTemporalUnitValuedOption: "Both singular and plural unit names are accepted".
  it.each`
    value                           | unit              | expected
    ${"2024-06-15T12:34:56"}        | ${"years"}        | ${"2024-01-01T00:00:00"}
    ${"2024-06-15T12:34:56"}        | ${"months"}       | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"}        | ${"weeks"}        | ${"2024-06-17T00:00:00"}
    ${"2024-06-15T12:34:56"}        | ${"days"}         | ${"2024-06-16T00:00:00"}
    ${"2024-06-15T12:34:56"}        | ${"hours"}        | ${"2024-06-15T13:00:00"}
    ${"2024-06-15T12:34:56"}        | ${"minutes"}      | ${"2024-06-15T12:35:00"}
    ${"2024-06-15T12:34:56.123456"} | ${"milliseconds"} | ${"2024-06-15T12:34:56.123"}
  `(
    "returns $expected for $value rounded to the plural unit $unit",
    ({ value, unit, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit })).toBe(expected);
    },
  );

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

  it.each`
    value                    | unit       | roundingMode    | expected
    ${"2024-06-16T00:00:00"} | ${"month"} | ${"halfExpand"} | ${"2024-07-01T00:00:00"}
    ${"2024-06-16T00:00:00"} | ${"month"} | ${"halfCeil"}   | ${"2024-07-01T00:00:00"}
    ${"2024-06-16T00:00:00"} | ${"month"} | ${"halfTrunc"}  | ${"2024-06-01T00:00:00"}
    ${"2024-06-16T00:00:00"} | ${"month"} | ${"halfFloor"}  | ${"2024-06-01T00:00:00"}
    ${"2024-06-16T00:00:00"} | ${"month"} | ${"halfEven"}   | ${"2024-06-01T00:00:00"}
  `(
    "returns $expected for half-boundary $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

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

  // Temporal GetRoundingIncrementOption: ToIntegerWithTruncation, then < 1 is a RangeError. The
  // date-unit branch follows it as the day and time branch (Temporal itself) already does.
  // 2024-05-20T00:00 is 19 of 31 days into May (rounds up); 2024-06-15T12:34:56 is 5.5 of 14 days
  // into the two-week span from Monday 2024-06-10 (rounds down).
  it.each`
    value                    | unit       | roundingIncrement | expected
    ${"2024-05-20T00:00:00"} | ${"month"} | ${1.5}            | ${"2024-06-01T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"week"}  | ${2.7}            | ${"2024-06-10T00:00:00"}
    ${"2024-06-15T12:34:56"} | ${"day"}   | ${1.5}            | ${"2024-06-16T00:00:00"}
  `(
    "returns $expected for $value with non-integer roundingIncrement $roundingIncrement truncated on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(
        roundDateTime(value, { smallestUnit: unit, roundingIncrement }),
      ).toBe(expected);
    },
  );

  it.each`
    value                    | unit       | roundingIncrement
    ${"2024-05-20T00:00:00"} | ${"month"} | ${0.9}
    ${"2024-05-20T00:00:00"} | ${"year"}  | ${Number.NaN}
    ${"2024-05-20T00:00:00"} | ${"week"}  | ${Number.POSITIVE_INFINITY}
    ${"2024-05-20T00:00:00"} | ${"day"}   | ${0.9}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement (below 1 after truncation or non-finite) on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundDateTime(value, { smallestUnit: unit, roundingIncrement }),
      ).toBe("");
    },
  );

  // Temporal GetRoundingModeOption: a value outside the nine rounding modes is a RangeError.
  it.each`
    value                    | unit       | roundingMode
    ${"2024-05-15T12:00:00"} | ${"month"} | ${"bogus"}
    ${"2024-05-15T12:00:00"} | ${"year"}  | ${"HALFEXPAND"}
    ${"2024-05-15T12:00:00"} | ${"week"}  | ${""}
    ${"2024-05-15T12:00:00"} | ${"day"}   | ${"bogus"}
    ${"2024-05-15T12:00:00"} | ${"hour"}  | ${"round"}
  `(
    "returns empty string for $value with unknown roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        "",
      );
    },
  );

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

  it.each`
    nonStringInput
    ${"invalid"}
    ${"2024-02-30T12:34:56"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T12:34:60"}
    ${"2024-02-29T12:34:56Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(roundDateTime(nonStringInput, { smallestUnit: "hour" })).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"hourss"}
    ${"Days"}
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

  it("returns empty string when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hour" })).toBe(
      "",
    );
  });

  // The first representable PlainDateTime is -271821-04-19T00:00:00.000000001 (a Monday), so the
  // month, year and even the week holding -271821-04-19T12:00:00 began before the range. Rounding
  // may only return the next start: 12:00 on 04-19 is 18.5/30 through April (halfExpand rounds up)
  // and 0.5/7 through its week (rounds down to a start that does not exist, so the sentinel).
  it.each`
    value                       | unit       | roundingMode    | expected
    ${"-271821-04-19T12:00:00"} | ${"month"} | ${"halfExpand"} | ${"-271821-05-01T00:00:00"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"ceil"}       | ${"-271821-04-26T00:00:00"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"halfExpand"} | ${""}
    ${"-271821-04-19T12:00:00"} | ${"year"}  | ${"ceil"}       | ${"-271820-01-01T00:00:00"}
  `(
    "returns $expected for the first-day value $value rounded to $unit with roundingMode $roundingMode",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDateTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );
});
