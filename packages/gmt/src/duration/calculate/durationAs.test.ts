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
    ${"P1M"} | ${"days"} | ${"2024-02-10[u-ca=hebrew]"} | ${30}    | ${"GMT digits: Hebrew year 2024, Heshvan (30 days), not ISO 2024-02-10"}
  `(
    "totals $value as $expected in $unit relativeTo calendar-annotated $relativeTo ($note)",
    ({ value, unit, relativeTo, expected }) => {
      expect(durationAs(value, unit, { relativeTo })).toBe(expected);
    },
  );

  // One tag, one date: a `[u-ca=...]` relativeTo that is not GMT's E1 PlainDate shape is not read
  // with Temporal's ISO digits instead — that would give the same tag two readings. RFC 9557 §3.3:
  // the critical flag does not change what the tag means; §4.1 suffix values are case-insensitive
  // ALPHA. Each of these would otherwise total with ISO digits (29, 28 …) rather than null.
  it.each`
    relativeTo                                       | reason
    ${"5784-06-01[!u-ca=hebrew]"}                    | ${"critical flag"}
    ${"5784-06-01[u-ca=HEBREW]"}                     | ${"upper-case calendar id"}
    ${"5784-06-01[U-CA=hebrew]"}                     | ${"upper-case key"}
    ${"5784-06-01[u-ca=hebrew][foo=bar]"}            | ${"trailing elective annotation"}
    ${"0006-02-01[!u-ca=japanese]"}                  | ${"critical flag, era calendar"}
    ${"5784-06-01T00:00:00[u-ca=hebrew]"}            | ${"PlainDateTime with a calendar annotation"}
    ${"5784-06-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"RFC 9557 segment order [zone][u-ca=]"}
    ${"5784-06-01T00:00:00+00:00[u-ca=hebrew][UTC]"} | ${"GMT E7 segment order [u-ca=][zone]"}
  `(
    "returns null when relativeTo $relativeTo carries a calendar annotation that is not GMT's PlainDate shape ($reason)",
    ({ relativeTo }) => {
      expect(durationAs("P1M", "days", { relativeTo })).toBeNull();
    },
  );

  // Temporal's ParseISODateTime clamps a second of 60 to 59, in every spelling its grammar accepts.
  it.each`
    relativeTo                          | reason
    ${"2016-12-31T23:59:60+00:00[UTC]"} | ${"zoned, uppercase T"}
    ${"2016-12-31t23:59:60+00:00[UTC]"} | ${"zoned, lowercase t"}
    ${"2016-12-31 23:59:60+00:00[UTC]"} | ${"zoned, space separator"}
    ${"20161231T235960Z[UTC]"}          | ${"zoned, basic format"}
    ${"2016-12-31T23:59:60"}            | ${"PlainDateTime, no designator"}
    ${"2016-12-31t235960.5"}            | ${"PlainDateTime, basic with fraction"}
  `(
    "returns null for a leap-second relativeTo $relativeTo ($reason)",
    ({ relativeTo }) => {
      expect(durationAs("PT1H", "seconds", { relativeTo })).toBeNull();
    },
  );

  it.each`
    relativeTo                                      | expected | reason
    ${"2024-01-01T00:00:00+00:00[UTC][x=T123460Z]"} | ${24}    | ${"an annotation value is not a time of day"}
    ${"2024-01-01T00:00:00+00:00[UTC][foo=bar]"}    | ${24}    | ${"elective annotation without a calendar"}
  `(
    "totals P1D as $expected hours relativeTo $relativeTo ($reason)",
    ({ relativeTo, expected }) => {
      expect(durationAs("P1D", "hours", { relativeTo })).toBe(expected);
    },
  );

  it("returns null when a calendar-annotated relativeTo is malformed", () => {
    expect(
      durationAs("P1M", "days", { relativeTo: "5783-14-01[u-ca=hebrew]" }),
    ).toBeNull();
  });

  // A zoned relativeTo string resolves with disambiguation "compatible" and offset "reject"
  // (GetTemporalRelativeToOption): ambiguous 01:30 takes the earlier (EDT) instant, from which
  // a day is 25 hours; a mismatched offset is rejected.
  it.each`
    relativeTo                                       | expected | note
    ${"2024-11-03T01:30[America/New_York]"}          | ${25}    | ${"ambiguous, compatible takes earlier EDT"}
    ${"2024-11-03T01:30-05:00[America/New_York]"}    | ${24}    | ${"explicit later EST offset"}
    ${"2024-03-10T00:00:00-04:00[America/New_York]"} | ${null}  | ${"offset does not match zone, rejected"}
  `(
    "totals P1D as $expected hours relativeTo $relativeTo ($note)",
    ({ relativeTo, expected }) => {
      expect(durationAs("P1D", "hours", { relativeTo })).toBe(expected);
    },
  );

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

describe("durationAs relative to the last days of the range", () => {
  // Both anchors are max - 3d5h. TC39 NudgeToCalendarUnit totals PT49H over the day from
  // +275760-09-12 local, 2 + 1/24 days; P3D is 72 exact hours. The window's end wall clock is past
  // +275760-09-13T00:00 in a zone ahead of UTC, but its exact time is in range.
  it.each`
    value      | unit       | relativeTo                                            | expected
    ${"PT49H"} | ${"days"}  | ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}   | ${2.0416666666666665}
    ${"P3D"}   | ${"hours"} | ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}   | ${72}
    ${"PT49H"} | ${"days"}  | ${"+275760-09-10T09:00:00+14:00[Pacific/Kiritimati]"} | ${2.0416666666666665}
  `(
    "totals $value as $expected $unit relative to $relativeTo",
    ({ value, unit, relativeTo, expected }) => {
      expect(durationAs(value, unit, { relativeTo })).toBe(expected);
    },
  );

  // From max - 2d1h the day window ends 23 hours past the maximum, which
  // GetPossibleEpochNanoseconds rejects in UTC as in every other zone.
  it.each`
    relativeTo
    ${"+275760-09-10T23:00:00+00:00[UTC]"}
    ${"+275760-09-10T23:00:00+00:00[+00:00]"}
    ${"+275760-09-11T00:00:00+01:00[Europe/London]"}
  `(
    "returns null totalling PT49H in days relative to $relativeTo",
    ({ relativeTo }) => {
      expect(durationAs("PT49H", "days", { relativeTo })).toBeNull();
    },
  );
});

describe("durationAs relative to the first days of the range", () => {
  // Both anchors are min + 3d. TC39 NudgeToCalendarUnit totals -PT49H over the day back to
  // -271821-04-20 local, -(2 + 1/24) days; that window reaches the minimum's local date
  // -271821-04-19 in a zone behind UTC, whose exact times are in range.
  it.each`
    relativeTo
    ${"-271821-04-22T19:03:58-04:56[America/New_York]"}
    ${"-271821-04-22T13:28:34-10:31[Pacific/Honolulu]"}
  `(
    "totals -PT49H as -2.0416666666666665 days relative to $relativeTo",
    ({ relativeTo }) => {
      expect(durationAs("-PT49H", "days", { relativeTo })).toBe(
        -2.0416666666666665,
      );
    },
  );
});

// CORE-6 S7: a non-ISO calendar `relativeTo` follows TC39 Duration#total with a plain relativeTo.
// Values: Chromium 153 native `Duration.from(d).total({ unit, relativeTo: PlainDate })`; null
// where Chromium throws.
describe("durationAs with a non-ISO calendar relativeTo (CORE-6)", () => {
  it.each`
    duration  | unit        | relativeTo                      | expected | reason
    ${"P40D"} | ${"months"} | ${"279517-08-15[u-ca=hebrew]"}  | ${null}  | ${"D1: the 1-month window after the first month passes the maximum"}
    ${"P1M"}  | ${"days"}   | ${"279517-08-01[u-ca=hebrew]"}  | ${30}    | ${"D1 control: M07 of 279517 has 30 days"}
    ${"P30D"} | ${"months"} | ${"2566-08-31[u-ca=buddhist]"}  | ${1}     | ${"D6: the window Aug 31 to Sep 30 ends exactly on the target"}
    ${"P1M"}  | ${"days"}   | ${"1543-02-01[u-ca=buddhist]"}  | ${28}    | ${"proleptic buddhist: ISO 1000 is not a leap year"}
    ${"P1Y"}  | ${"days"}   | ${"1543-03-01[u-ca=buddhist]"}  | ${365}   | ${"proleptic buddhist: no Feb 29 in ISO 1000"}
    ${"P1M"}  | ${"days"}   | ${"-096239-06-23[u-ca=hebrew]"} | ${29}    | ${"hebrew year <= 0: M06 has 29 days"}
    ${"P1Y"}  | ${"days"}   | ${"-096239-06-23[u-ca=hebrew]"} | ${355}   | ${"hebrew year <= 0: a 355-day year from M06-23"}
    ${"P1M"}  | ${"days"}   | ${"0000-01-13[u-ca=hebrew]"}    | ${30}    | ${"hebrew year 0: M01 has 30 days"}
  `(
    "returns $expected for $duration in $unit relative to $relativeTo ($reason)",
    ({ duration, unit, relativeTo, expected }) => {
      expect(durationAs(duration, unit, { relativeTo })).toBe(expected);
    },
  );
});
