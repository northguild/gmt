import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { roundDate } from "./roundDate";

describe("roundDate", () => {
  // happy path: all supported date units with default rounding
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

  // rounding modes
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

  // rounding increments
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

  // zero and negative roundingIncrement return ""
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

  // exact half-boundary cases
  it.each`
    value           | unit       | roundingMode    | expected
    ${"2024-06-16"} | ${"month"} | ${"halfExpand"} | ${"2024-07-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfCeil"}   | ${"2024-07-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfTrunc"}  | ${"2024-06-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfFloor"}  | ${"2024-06-01"}
    ${"2024-06-16"} | ${"month"} | ${"halfEven"}   | ${"2024-07-01"}
  `(
    "returns $expected for half-boundary $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundDate(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // invalid date values
  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(roundDate(invalidDate, { smallestUnit: "month" })).toBe("");
  });

  // invalid unit values
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

  // error path: Temporal.PlainDate.from throws
  it("returns empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(roundDate("2024-06-15", { smallestUnit: "month" })).toBe("");
  });
});
