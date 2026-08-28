import { durationAs } from "./durationAs";

describe("durationAs", () => {
  // The three calendar units are absent here: they require relativeTo even on this
  // day/time-only input, and are covered by their own table below.
  it.each`
    unit              | expected
    ${"days"}         | ${1.1041666666666667}
    ${"hours"}        | ${26.5}
    ${"minutes"}      | ${1590}
    ${"seconds"}      | ${95400}
    ${"milliseconds"} | ${95400000}
    ${"microseconds"} | ${95400000000}
    ${"nanoseconds"}  | ${95400000000000}
  `(
    "totals P1DT2H30M as $expected in $unit without a relativeTo anchor",
    ({ unit, expected }) => {
      expect(durationAs("P1DT2H30M", unit)).toBe(expected);
    },
  );

  it.each`
    unit              | expected
    ${"years"}        | ${1.2307077625570777}
    ${"months"}       | ${14.813172043010752}
    ${"weeks"}        | ${64.31547619047619}
    ${"days"}         | ${450.2083333333333}
    ${"hours"}        | ${10805}
    ${"minutes"}      | ${648300}
    ${"seconds"}      | ${38898000}
    ${"milliseconds"} | ${38898000000}
    ${"microseconds"} | ${38898000000000}
    ${"nanoseconds"}  | ${38898000000000000}
  `(
    "totals P1Y2M3W4DT5H as $expected in $unit relativeTo 2024-01-01",
    ({ unit, expected }) => {
      expect(
        durationAs("P1Y2M3W4DT5H", unit, { relativeTo: "2024-01-01" }),
      ).toBe(expected);
    },
  );

  // The requested unit alone forces relativeTo: "weeks" is a calendar quantity to Temporal
  // even when the duration being measured has no calendar component at all.
  it.each`
    value          | unit
    ${"P1DT2H30M"} | ${"years"}
    ${"P1DT2H30M"} | ${"months"}
    ${"P1DT2H30M"} | ${"weeks"}
    ${"PT36H"}     | ${"weeks"}
    ${"PT0S"}      | ${"months"}
  `(
    "returns null totalling day/time-only $value into the calendar unit $unit without relativeTo",
    ({ value, unit }) => {
      expect(durationAs(value, unit)).toBeNull();
    },
  );

  // The other half of the rule: a calendar component already in the input forces relativeTo
  // for every requested unit, including time units that need no anchor on their own.
  it.each`
    value     | unit
    ${"P1Y"}  | ${"days"}
    ${"P1M"}  | ${"days"}
    ${"P1M"}  | ${"hours"}
    ${"P1W"}  | ${"days"}
    ${"P1W"}  | ${"hours"}
    ${"-P1M"} | ${"seconds"}
  `(
    "returns null totalling calendar-unit $value into $unit without relativeTo",
    ({ value, unit }) => {
      expect(durationAs(value, unit)).toBeNull();
    },
  );

  it.each`
    value     | unit        | relativeTo      | expected
    ${"P1M"}  | ${"days"}   | ${"2024-01-01"} | ${31}
    ${"P1M"}  | ${"days"}   | ${"2024-02-01"} | ${29}
    ${"P1M"}  | ${"days"}   | ${"2023-02-01"} | ${28}
    ${"P1M"}  | ${"days"}   | ${"2024-04-01"} | ${30}
    ${"-P1M"} | ${"days"}   | ${"2024-03-01"} | ${-29}
    ${"P1W"}  | ${"days"}   | ${"2024-01-01"} | ${7}
    ${"P1W"}  | ${"hours"}  | ${"2024-01-01"} | ${168}
    ${"P1Y"}  | ${"months"} | ${"2024-01-01"} | ${12}
  `(
    "totals $value as $expected in $unit relativeTo $relativeTo",
    ({ value, unit, relativeTo, expected }) => {
      expect(durationAs(value, unit, { relativeTo })).toBe(expected);
    },
  );

  // E5 (issue #78): relativeTo accepts a GMT calendar-annotated PlainDate string ("5784-06-
  // 15[u-ca=hebrew]" — calendar-native digits, as convertDateToCalendar produces), not
  // Temporal's own ISO-digit u-ca convention. Regression goldens verified directly against
  // @js-temporal/polyfill: before this fix, the Hebrew-shape string below was silently
  // misread as ISO year 5784 and returned 354, not 385.
  it.each`
    value    | unit      | relativeTo                   | expected | note
    ${"P1Y"} | ${"days"} | ${"5784-06-15[u-ca=hebrew]"} | ${385}   | ${"Hebrew leap year 5784"}
    ${"P1M"} | ${"days"} | ${"5785-04-15[u-ca=hebrew]"} | ${29}    | ${"Tevet, a 29-day Hebrew month"}
    ${"P1M"} | ${"days"} | ${"2024-02-10[u-ca=hebrew]"} | ${30}    | ${"Temporal's own u-ca shape still works unchanged (ISO digits)"}
  `(
    "totals $value as $expected in $unit relativeTo calendar-annotated $relativeTo ($note)",
    ({ value, unit, relativeTo, expected }) => {
      expect(durationAs(value, unit, { relativeTo })).toBe(expected);
    },
  );

  it("returns null when a calendar-annotated relativeTo is malformed", () => {
    expect(
      durationAs("P1M", "days", { relativeTo: "5783-14-01[u-ca=hebrew]" }),
    ).toBeNull();
  });

  // relativeTo is not inert on day/time units: anchored to a zoned instant it resolves real
  // elapsed time, so a calendar day across a DST transition is not 24 hours.
  it.each`
    relativeTo                                       | expected | note
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${23}    | ${"spring-forward"}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${25}    | ${"fall-back"}
    ${"2024-03-31T00:00:00+01:00[Europe/Berlin]"}    | ${23}    | ${"spring-forward"}
    ${"2024-10-27T00:00:00+02:00[Europe/Berlin]"}    | ${25}    | ${"fall-back"}
    ${"2024-06-15T00:00:00-04:00[America/New_York]"} | ${24}    | ${"no transition"}
  `(
    "totals P1D as $expected hours relativeTo $relativeTo ($note)",
    ({ relativeTo, expected }) => {
      expect(durationAs("P1D", "hours", { relativeTo })).toBe(expected);
    },
  );

  it.each`
    value       | unit              | expected
    ${"PT36H"}  | ${"days"}         | ${1.5}
    ${"PT1.5S"} | ${"seconds"}      | ${1.5}
    ${"PT1.5S"} | ${"milliseconds"} | ${1500}
    ${"PT1.5S"} | ${"microseconds"} | ${1500000}
    ${"PT1.5S"} | ${"nanoseconds"}  | ${1500000000}
    ${"PT1.5S"} | ${"hours"}        | ${0.0004166666666666667}
  `(
    "totals fractional $value as $expected in $unit",
    ({ value, unit, expected }) => {
      expect(durationAs(value, unit)).toBe(expected);
    },
  );

  it.each`
    value        | unit         | expected
    ${"-PT90M"}  | ${"minutes"} | ${-90}
    ${"-PT90M"}  | ${"hours"}   | ${-1.5}
    ${"-P1DT2H"} | ${"hours"}   | ${-26}
    ${"-P1D"}    | ${"days"}    | ${-1}
  `(
    "totals negative $value as $expected in $unit",
    ({ value, unit, expected }) => {
      expect(durationAs(value, unit)).toBe(expected);
    },
  );

  it.each`
    value      | unit         | expected
    ${"PT0S"}  | ${"seconds"} | ${0}
    ${"PT0S"}  | ${"days"}    | ${0}
    ${"P0D"}   | ${"hours"}   | ${0}
    ${"-PT0S"} | ${"seconds"} | ${0}
  `(
    "totals the zero-length duration $value as 0 in $unit",
    ({ value, unit, expected }) => {
      expect(durationAs(value, unit)).toBe(expected);
    },
  );

  it("returns the same total whether relativeTo is omitted or irrelevant to the unit", () => {
    expect(durationAs("P1DT2H30M", "minutes")).toBe(1590);
    expect(durationAs("P1DT2H30M", "minutes", {})).toBe(1590);
    expect(
      durationAs("P1DT2H30M", "minutes", { relativeTo: "2024-01-01" }),
    ).toBe(1590);
  });

  it.each`
    value
    ${"not a duration"}
    ${""}
    ${"P"}
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
      expect(durationAs(value, "hours")).toBeNull();
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
      expect(durationAs("P1DT2H30M", unit)).toBeNull();
    },
  );

  it.each`
    relativeTo
    ${"not a date"}
    ${""}
    ${"2024-13-45"}
    ${123}
    ${true}
    ${[]}
  `("returns null when relativeTo $relativeTo is invalid", ({ relativeTo }) => {
    expect(durationAs("P1M", "days", { relativeTo })).toBeNull();
  });

  it("never throws on invalid input", () => {
    expect(() =>
      durationAs("not a duration", "nope" as never, {
        relativeTo: "not a date",
      }),
    ).not.toThrow();
  });
});
