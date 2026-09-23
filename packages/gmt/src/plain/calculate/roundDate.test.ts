import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { roundDate } from "./roundDate";

describe("roundDate", () => {
  it.each`
    value           | unit       | expected
    ${"2024-06-15"} | ${"year"}  | ${"2024-01-01"}
    ${"2024-06-15"} | ${"month"} | ${"2024-06-01"}
    ${"2024-06-15"} | ${"week"}  | ${"2024-06-17"}
    ${"2024-06-15"} | ${"day"}   | ${"2024-06-15"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundDate(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  it.each`
    value           | unit       | roundingMode    | expected
    ${"2024-02-15"} | ${"month"} | ${"floor"}      | ${"2024-02-01"}
    ${"2024-02-15"} | ${"month"} | ${"ceil"}       | ${"2024-03-01"}
    ${"2024-02-15"} | ${"month"} | ${"expand"}     | ${"2024-03-01"}
    ${"2024-02-15"} | ${"month"} | ${"trunc"}      | ${"2024-02-01"}
    ${"2024-06-15"} | ${"month"} | ${"halfExpand"} | ${"2024-06-01"}
    ${"2024-06-15"} | ${"month"} | ${"halfCeil"}   | ${"2024-06-01"}
    ${"2024-06-15"} | ${"month"} | ${"halfTrunc"}  | ${"2024-06-01"}
    ${"2024-06-15"} | ${"month"} | ${"halfFloor"}  | ${"2024-06-01"}
    ${"2024-06-15"} | ${"month"} | ${"halfEven"}   | ${"2024-06-01"}
    ${"2024-01-01"} | ${"year"}  | ${"halfExpand"} | ${"2024-01-01"}
    ${"2024-12-31"} | ${"year"}  | ${"halfExpand"} | ${"2025-01-01"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  it.each`
    value           | unit      | roundingIncrement | expected
    ${"2024-06-15"} | ${"day"}  | ${2}              | ${"2024-06-15"}
    ${"2024-06-15"} | ${"week"} | ${2}              | ${"2024-06-10"}
    ${"2024-06-10"} | ${"week"} | ${2}              | ${"2024-06-10"}
    ${"2024-06-17"} | ${"week"} | ${2}              | ${"2024-06-17"}
  `(
    "returns $expected for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingIncrement })).toBe(
        expected,
      );
    },
  );

  it.each`
    value           | unit       | roundingIncrement
    ${"2024-06-15"} | ${"day"}   | ${0}
    ${"2024-06-15"} | ${"week"}  | ${-1}
    ${"2024-06-15"} | ${"month"} | ${0}
    ${"2024-06-15"} | ${"year"}  | ${-2}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingIncrement })).toBe(
        "",
      );
    },
  );

  // Temporal GetRoundingIncrementOption: ToIntegerWithTruncation, then < 1 is a RangeError.
  // 2024-05-20 is 19 of 31 days into May (0.61, rounds up); 2024-06-15 is 5 of 14 days into the
  // two-week span from Monday 2024-06-10 (rounds down).
  it.each`
    value           | unit       | roundingIncrement | expected
    ${"2024-05-20"} | ${"month"} | ${1.5}            | ${"2024-06-01"}
    ${"2024-06-15"} | ${"week"}  | ${2.7}            | ${"2024-06-10"}
    ${"2024-06-15"} | ${"day"}   | ${1.9}            | ${"2024-06-15"}
  `(
    "returns $expected for $value with non-integer roundingIncrement $roundingIncrement truncated on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingIncrement })).toBe(
        expected,
      );
    },
  );

  it.each`
    value           | unit       | roundingIncrement
    ${"2024-05-20"} | ${"month"} | ${0.9}
    ${"2024-05-20"} | ${"day"}   | ${-0.5}
    ${"2024-05-20"} | ${"year"}  | ${Number.NaN}
    ${"2024-05-20"} | ${"week"}  | ${Number.POSITIVE_INFINITY}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement (below 1 after truncation or non-finite) on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingIncrement })).toBe(
        "",
      );
    },
  );

  // Temporal GetRoundingModeOption: a value outside the nine rounding modes is a RangeError.
  it.each`
    value           | unit       | roundingMode
    ${"2024-05-20"} | ${"month"} | ${"bogus"}
    ${"2024-05-20"} | ${"year"}  | ${"HALFEXPAND"}
    ${"2024-05-20"} | ${"week"}  | ${""}
    ${"2024-05-20"} | ${"day"}   | ${"round"}
  `(
    "returns empty string for $value with unknown roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingMode })).toBe("");
    },
  );

  it.each`
    value           | unit       | roundingMode    | expected
    ${"2024-06-16"} | ${"month"} | ${"halfExpand"} | ${"2024-07-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfCeil"}   | ${"2024-07-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfTrunc"}  | ${"2024-06-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfFloor"}  | ${"2024-06-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfEven"}   | ${"2024-06-01"}
  `(
    "returns $expected for half-boundary $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(roundDate(nonStringInput, { smallestUnit: "month" })).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"decade"}
    ${"century"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      roundDate("2024-06-15", { smallestUnit: invalidUnit as never }),
    ).toBe("");
  });

  it("returns empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(roundDate("2024-06-15", { smallestUnit: "month" })).toBe("");
  });

  // -271821-04-19 is the first representable PlainDate (a Monday). Its month and year began before
  // the range, so rounding may only return the next start. April has 30 days, so 04-19 is 18/30 =
  // 0.6 of the way through its month (halfExpand rounds up); it is 108/365 through its year (rounds
  // down, to a start that does not exist, so the sentinel). A Monday is its own week start.
  it.each`
    value              | unit       | roundingMode    | expected
    ${"-271821-04-19"} | ${"month"} | ${"halfExpand"} | ${"-271821-05-01"}
    ${"-271821-04-19"} | ${"month"} | ${"ceil"}       | ${"-271821-05-01"}
    ${"-271821-04-19"} | ${"month"} | ${"floor"}      | ${""}
    ${"-271821-04-19"} | ${"year"}  | ${"ceil"}       | ${"-271820-01-01"}
    ${"-271821-04-19"} | ${"year"}  | ${"halfExpand"} | ${""}
    ${"-271821-04-19"} | ${"week"}  | ${"halfExpand"} | ${"-271821-04-19"}
  `(
    "returns $expected for the first PlainDate $value rounded to $unit with roundingMode $roundingMode",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // +275760-09-13 is the last representable PlainDate (a Saturday, day 257 of the leap year 275760).
  // The next week, month and year start after it, so a mode that picks the current start still has
  // a value: 06-15 is 166/366 through its year (under half), 09-10 is 9/30 through September and a
  // Wednesday 2/7 through its week, 09-13 is 12/30 through September but 5/7 through its week (over
  // half, so up to 09-15, which does not exist). Increment 2 spans Sep+Oct (61 days) or 275760+275761
  // (366+365 days), both still under half. ceil past the last date is the sentinel.
  it.each`
    value              | unit       | roundingMode    | increment | expected
    ${"+275760-06-15"} | ${"year"}  | ${"floor"}      | ${1}      | ${"+275760-01-01"}
    ${"+275760-06-15"} | ${"year"}  | ${"trunc"}      | ${1}      | ${"+275760-01-01"}
    ${"+275760-06-15"} | ${"year"}  | ${"halfExpand"} | ${1}      | ${"+275760-01-01"}
    ${"+275760-06-15"} | ${"year"}  | ${"halfExpand"} | ${2}      | ${"+275760-01-01"}
    ${"+275760-01-01"} | ${"year"}  | ${"halfExpand"} | ${1}      | ${"+275760-01-01"}
    ${"+275760-06-15"} | ${"year"}  | ${"ceil"}       | ${1}      | ${""}
    ${"+275760-09-13"} | ${"year"}  | ${"halfExpand"} | ${1}      | ${""}
    ${"+275760-09-10"} | ${"month"} | ${"floor"}      | ${1}      | ${"+275760-09-01"}
    ${"+275760-09-13"} | ${"month"} | ${"halfExpand"} | ${1}      | ${"+275760-09-01"}
    ${"+275760-09-13"} | ${"month"} | ${"halfEven"}   | ${2}      | ${"+275760-09-01"}
    ${"+275760-09-10"} | ${"month"} | ${"ceil"}       | ${1}      | ${""}
    ${"+275760-09-13"} | ${"week"}  | ${"floor"}      | ${1}      | ${"+275760-09-08"}
    ${"+275760-09-10"} | ${"week"}  | ${"halfExpand"} | ${1}      | ${"+275760-09-08"}
    ${"+275760-09-13"} | ${"week"}  | ${"halfExpand"} | ${1}      | ${""}
    ${"+275760-09-13"} | ${"week"}  | ${"ceil"}       | ${1}      | ${""}
  `(
    "returns $expected for the last-year PlainDate $value rounded to $unit (increment $increment) with roundingMode $roundingMode",
    ({ value, unit, roundingMode, increment, expected }) => {
      expect(
        roundDate(value, {
          smallestUnit: unit,
          roundingMode,
          roundingIncrement: increment,
        }),
      ).toBe(expected);
    },
  );
});

describe("roundDate with a plural smallestUnit", () => {
  // Temporal §13.17 GetTemporalUnitValuedOption: "Both singular and plural unit names are accepted",
  // so each plural rounds exactly as its singular. 2024-06-15 is day 166 of 366 (under half: the
  // year's start), 14 of 30 days into June (under half), and a Saturday 5 of 7 days into its
  // Monday week (over half: the next Monday). 2024-06-16 is exactly half way through June, and
  // halfExpand rounds the tie up.
  it.each`
    value           | unit        | roundingIncrement | expected
    ${"2024-06-15"} | ${"years"}  | ${undefined}      | ${"2024-01-01"}
    ${"2024-06-15"} | ${"months"} | ${undefined}      | ${"2024-06-01"}
    ${"2024-06-16"} | ${"months"} | ${undefined}      | ${"2024-07-01"}
    ${"2024-06-15"} | ${"weeks"}  | ${undefined}      | ${"2024-06-17"}
    ${"2024-06-15"} | ${"weeks"}  | ${2}              | ${"2024-06-10"}
    ${"2024-06-15"} | ${"days"}   | ${undefined}      | ${"2024-06-15"}
  `(
    "returns $expected for $value rounded to the plural unit $unit with increment $roundingIncrement",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingIncrement })).toBe(
        expected,
      );
    },
  );

  it.each`
    unit
    ${"hours"}
    ${"dayss"}
    ${"s"}
  `("returns an empty string for the unit $unit", ({ unit }) => {
    expect(roundDate("2024-06-15", { smallestUnit: unit as never })).toBe("");
  });
});
