import { getDurationUnit } from "./getDurationUnit";

describe("getDurationUnit", () => {
  // Every field of a duration carrying a nonzero value in all ten components, so each
  // unit row proves it reads its own field rather than a neighbouring one.
  it.each`
    unit              | expected
    ${"years"}        | ${1}
    ${"months"}       | ${2}
    ${"weeks"}        | ${3}
    ${"days"}         | ${4}
    ${"hours"}        | ${5}
    ${"minutes"}      | ${6}
    ${"seconds"}      | ${7}
    ${"milliseconds"} | ${8}
    ${"microseconds"} | ${9}
    ${"nanoseconds"}  | ${10}
  `(
    "reads $unit as $expected from P1Y2M3W4DT5H6M7.008009010S",
    ({ unit, expected }) => {
      expect(getDurationUnit("P1Y2M3W4DT5H6M7.008009010S", unit)).toBe(
        expected,
      );
    },
  );

  it.each`
    unit              | expected
    ${"years"}        | ${-1}
    ${"months"}       | ${-2}
    ${"weeks"}        | ${-3}
    ${"days"}         | ${-4}
    ${"hours"}        | ${-5}
    ${"minutes"}      | ${-6}
    ${"seconds"}      | ${-7}
    ${"milliseconds"} | ${-8}
    ${"microseconds"} | ${-9}
    ${"nanoseconds"}  | ${-10}
  `(
    "reads $unit as $expected from -P1Y2M3W4DT5H6M7.008009010S, where every field is negative",
    ({ unit, expected }) => {
      expect(getDurationUnit("-P1Y2M3W4DT5H6M7.008009010S", unit)).toBe(
        expected,
      );
    },
  );

  it.each`
    unit              | expected
    ${"years"}        | ${0}
    ${"months"}       | ${0}
    ${"weeks"}        | ${0}
    ${"days"}         | ${0}
    ${"hours"}        | ${0}
    ${"minutes"}      | ${0}
    ${"seconds"}      | ${0}
    ${"milliseconds"} | ${0}
    ${"microseconds"} | ${0}
    ${"nanoseconds"}  | ${0}
  `("reads $unit as 0 from the zero-length duration PT0S", ({ unit }) => {
    expect(getDurationUnit("PT0S", unit)).toBe(0);
  });

  it.each`
    value       | unit         | expected
    ${"PT90M"}  | ${"hours"}   | ${0}
    ${"PT90M"}  | ${"minutes"} | ${90}
    ${"PT36H"}  | ${"days"}    | ${0}
    ${"PT36H"}  | ${"hours"}   | ${36}
    ${"P1DT2H"} | ${"minutes"} | ${0}
    ${"P400D"}  | ${"years"}   | ${0}
    ${"P400D"}  | ${"days"}    | ${400}
  `(
    "reads $value's $unit as the stored $expected rather than a converted total",
    ({ value, unit, expected }) => {
      expect(getDurationUnit(value, unit)).toBe(expected);
    },
  );

  it.each`
    value       | unit              | expected
    ${"PT1.5H"} | ${"hours"}        | ${1}
    ${"PT1.5H"} | ${"minutes"}      | ${30}
    ${"PT1.5S"} | ${"seconds"}      | ${1}
    ${"PT1.5S"} | ${"milliseconds"} | ${500}
    ${"PT1.5S"} | ${"microseconds"} | ${0}
  `(
    "reads $unit as $expected from $value, which Temporal balances at parse time",
    ({ value, unit, expected }) => {
      expect(getDurationUnit(value, unit)).toBe(expected);
    },
  );

  it.each`
    value     | unit        | expected
    ${"P1Y"}  | ${"years"}  | ${1}
    ${"P1M"}  | ${"months"} | ${1}
    ${"P1W"}  | ${"weeks"}  | ${1}
    ${"-P1M"} | ${"months"} | ${-1}
  `(
    "reads the calendar unit $unit as $expected from $value without a relativeTo anchor",
    ({ value, unit, expected }) => {
      expect(getDurationUnit(value, unit)).toBe(expected);
    },
  );

  it.each`
    value
    ${"not a duration"}
    ${""}
    ${"P"}
    ${"1D"}
    ${"2024-03-10"}
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `(
    "returns null when value $value is not a valid duration string",
    ({ value }) => {
      expect(getDurationUnit(value, "hours")).toBeNull();
    },
  );

  it.each`
    unit
    ${"fortnights"}
    ${"hour"}
    ${"day"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${[]}
    ${{}}
  `(
    "returns null when unit $unit is not a valid DateTimeDurationUnit",
    ({ unit }) => {
      expect(getDurationUnit("P1DT2H30M", unit)).toBeNull();
    },
  );

  it("never throws on invalid input", () => {
    expect(() =>
      getDurationUnit("not a duration", "nope" as never),
    ).not.toThrow();
  });
});
