import { compareDurations } from "./compareDurations";

describe("compareDurations", () => {
  it.each`
    a          | b          | expected
    ${"PT1H"}  | ${"PT30M"} | ${1}
    ${"PT30M"} | ${"PT1H"}  | ${-1}
    ${"P2D"}   | ${"P1D"}   | ${1}
    ${"P1D"}   | ${"PT23H"} | ${1}
    ${"PT23H"} | ${"P1D"}   | ${-1}
  `("returns $expected comparing $a to $b", ({ a, b, expected }) => {
    expect(compareDurations(a, b)).toBe(expected);
  });

  // Equality is by length, not spelling — the same span written two ways compares 0.
  it.each`
    a           | b             | expected
    ${"PT60M"}  | ${"PT1H"}     | ${0}
    ${"PT1H"}   | ${"PT60M"}    | ${0}
    ${"P1D"}    | ${"PT24H"}    | ${0}
    ${"PT1.5S"} | ${"PT1.500S"} | ${0}
    ${"PT0S"}   | ${"PT0S"}     | ${0}
    ${"PT0S"}   | ${"-PT0S"}    | ${0}
    ${"P0D"}    | ${"PT0S"}     | ${0}
  `(
    "returns $expected for the equal-length pair $a and $b",
    ({ a, b, expected }) => {
      expect(compareDurations(a, b)).toBe(expected);
    },
  );

  it.each`
    a           | b           | expected
    ${"-PT1H"}  | ${"PT1H"}   | ${-1}
    ${"PT1H"}   | ${"-PT1H"}  | ${1}
    ${"-PT1H"}  | ${"-PT30M"} | ${-1}
    ${"-PT30M"} | ${"-PT1H"}  | ${1}
    ${"-PT1H"}  | ${"PT0S"}   | ${-1}
    ${"PT0S"}   | ${"-PT1H"}  | ${1}
  `("returns $expected comparing negative $a to $b", ({ a, b, expected }) => {
    expect(compareDurations(a, b)).toBe(expected);
  });

  it.each`
    a         | b
    ${"P1M"}  | ${"P30D"}
    ${"P30D"} | ${"P1M"}
    ${"P1W"}  | ${"P7D"}
    ${"P1Y"}  | ${"P365D"}
    ${"PT1H"} | ${"P1M"}
    ${"-P1M"} | ${"PT1H"}
  `(
    "returns null comparing $a to $b when a calendar unit is present and relativeTo is absent",
    ({ a, b }) => {
      expect(compareDurations(a, b)).toBeNull();
    },
  );

  // Temporal.Duration.compare returns 0 for field-identical durations before it checks for
  // calendar units, so no relativeTo is needed; any difference still requires one.
  it.each`
    a           | b           | expected
    ${"P1Y"}    | ${"P1Y"}    | ${0}
    ${"P1M"}    | ${"P1M"}    | ${0}
    ${"P1W"}    | ${"P1W"}    | ${0}
    ${"-P2Y3M"} | ${"-P2Y3M"} | ${0}
    ${"P1M"}    | ${"P1M1D"}  | ${null}
  `(
    "returns $expected comparing calendar durations $a and $b without relativeTo",
    ({ a, b, expected }) => {
      expect(compareDurations(a, b)).toBe(expected);
    },
  );

  // A zoned relativeTo string resolves with disambiguation "compatible" and offset "reject"
  // (GetTemporalRelativeToOption): ambiguous 01:30 takes the earlier (EDT) instant, from which
  // a day is 25 hours; a mismatched offset is rejected even for identical operands.
  it.each`
    a        | b          | relativeTo                                       | expected | note
    ${"P1D"} | ${"PT24H"} | ${"2024-11-03T01:30[America/New_York]"}          | ${1}     | ${"ambiguous, compatible takes earlier EDT"}
    ${"P1D"} | ${"PT24H"} | ${"2024-11-03T01:30-05:00[America/New_York]"}    | ${0}     | ${"explicit later EST offset"}
    ${"P1D"} | ${"P1D"}   | ${"2024-03-10T00:00:00-04:00[America/New_York]"} | ${null}  | ${"offset does not match zone, rejected"}
  `(
    "returns $expected comparing $a to $b relativeTo $relativeTo ($note)",
    ({ a, b, relativeTo, expected }) => {
      expect(compareDurations(a, b, { relativeTo })).toBe(expected);
    },
  );

  // The anchor does not merely unblock the comparison, it decides it: a month is longer
  // than 30 days from January (31) and shorter from February 2024 (29).
  it.each`
    a        | b          | relativeTo      | expected
    ${"P1M"} | ${"P30D"}  | ${"2024-01-01"} | ${1}
    ${"P1M"} | ${"P30D"}  | ${"2024-02-01"} | ${-1}
    ${"P1M"} | ${"P30D"}  | ${"2024-04-01"} | ${0}
    ${"P1Y"} | ${"P365D"} | ${"2024-01-01"} | ${1}
    ${"P1Y"} | ${"P365D"} | ${"2023-01-01"} | ${0}
    ${"P1W"} | ${"P7D"}   | ${"2024-01-01"} | ${0}
    ${"P1Y"} | ${"P12M"}  | ${"2024-01-01"} | ${0}
    ${"P1D"} | ${"P1M"}   | ${"2024-01-01"} | ${-1}
  `(
    "returns $expected comparing $a to $b relativeTo $relativeTo",
    ({ a, b, relativeTo, expected }) => {
      expect(compareDurations(a, b, { relativeTo })).toBe(expected);
    },
  );

  // relativeTo accepts an RFC 9557 calendar-annotated PlainDate string (ISO digits). Expected:
  // native Temporal, Chromium 153.0.8010.12.
  it.each`
    a        | b         | relativeTo                    | expected | note
    ${"P1M"} | ${"P30D"} | ${"2025-01-15[u-ca=hebrew]"}  | ${-1}    | ${"Tevet, a 29-day Hebrew month"}
    ${"P1M"} | ${"P30D"} | ${"2024-02-24[u-ca=hebrew]"}  | ${0}     | ${"Adar I, a 30-day Hebrew month"}
    ${"P1M"} | ${"P30D"} | ${"2024-02-10[!u-ca=hebrew]"} | ${0}     | ${"critical flag: 1 Adar I 5784, 30 days"}
  `(
    "returns $expected comparing $a to $b relativeTo calendar-annotated $relativeTo ($note)",
    ({ a, b, relativeTo, expected }) => {
      expect(compareDurations(a, b, { relativeTo })).toBe(expected);
    },
  );

  // relativeTo is not calendar-units-only: anchored to a zoned instant it resolves real
  // elapsed time, so "P1D" stops being exactly 24 hours across a DST transition.
  it.each`
    relativeTo                                       | expected | note
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${-1}    | ${"spring-forward, 23h"}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${1}     | ${"fall-back, 25h"}
    ${"2024-03-31T00:00:00+01:00[Europe/Berlin]"}    | ${-1}    | ${"spring-forward, 23h"}
    ${"2024-10-27T00:00:00+02:00[Europe/Berlin]"}    | ${1}     | ${"fall-back, 25h"}
    ${"2024-06-15T00:00:00-04:00[America/New_York]"} | ${0}     | ${"no transition, 24h"}
  `(
    "returns $expected comparing P1D to PT24H relativeTo $relativeTo ($note)",
    ({ relativeTo, expected }) => {
      expect(compareDurations("P1D", "PT24H", { relativeTo })).toBe(expected);
    },
  );

  it("returns the same result whether relativeTo is omitted or irrelevant to the operands", () => {
    expect(compareDurations("PT1H", "PT30M")).toBe(1);
    expect(compareDurations("PT1H", "PT30M", {})).toBe(1);
    expect(
      compareDurations("PT1H", "PT30M", { relativeTo: "2024-01-01" }),
    ).toBe(1);
  });

  it.each`
    a                   | b                   | aLabel                | bLabel
    ${"not a duration"} | ${"PT1H"}           | ${"'not a duration'"} | ${"'PT1H'"}
    ${"PT1H"}           | ${"not a duration"} | ${"'PT1H'"}           | ${"'not a duration'"}
    ${""}               | ${"PT1H"}           | ${"''"}               | ${"'PT1H'"}
    ${"PT1H"}           | ${""}               | ${"'PT1H'"}           | ${"''"}
    ${"2024-03-10"}     | ${"PT1H"}           | ${"'2024-03-10'"}     | ${"'PT1H'"}
    ${null}             | ${"PT1H"}           | ${"null"}             | ${"'PT1H'"}
    ${"PT1H"}           | ${undefined}        | ${"'PT1H'"}           | ${"undefined"}
    ${123}              | ${"PT1H"}           | ${"123"}              | ${"'PT1H'"}
    ${"PT1H"}           | ${true}             | ${"'PT1H'"}           | ${"true"}
    ${[]}               | ${{}}               | ${"[]"}               | ${"{}"}
  `(
    "returns null when $aLabel or $bLabel is not a valid duration string",
    ({ a, b }) => {
      expect(compareDurations(a, b)).toBeNull();
    },
  );

  it.each`
    relativeTo      | label
    ${"not a date"} | ${"'not a date'"}
    ${""}           | ${"''"}
    ${"2024-13-45"} | ${"'2024-13-45'"}
    ${123}          | ${"123"}
    ${true}         | ${"true"}
    ${[]}           | ${"[]"}
  `("returns null when relativeTo $label is invalid", ({ relativeTo }) => {
    expect(compareDurations("P1M", "P30D", { relativeTo })).toBeNull();
  });

  // Temporal's ParseISODateTime clamps a second of 60 to 59 in every spelling its grammar
  // accepts (DateTimeSeparator SP/T/t, basic TimeSpec); GMT rejects a leap-second relativeTo instead.
  it.each`
    relativeTo                          | spelling
    ${"2016-12-31T23:59:60+00:00[UTC]"} | ${"zoned, uppercase T"}
    ${"2016-12-31t23:59:60+00:00[UTC]"} | ${"zoned, lowercase t"}
    ${"20161231T235960Z[UTC]"}          | ${"zoned, basic format"}
    ${"2016-12-31 23:59:60"}            | ${"PlainDateTime, space separator"}
  `(
    "returns null for a leap-second relativeTo $relativeTo ($spelling)",
    ({ relativeTo }) => {
      expect(compareDurations("PT1H", "PT3600S", { relativeTo })).toBeNull();
    },
  );

  it("never throws on invalid input", () => {
    expect(() =>
      compareDurations("not a duration", "P1M", { relativeTo: "not a date" }),
    ).not.toThrow();
  });
});

describe("compareDurations relative to the last days of the range", () => {
  // TC39 Duration.compare adds both to the anchor (max - 3d5h): P3D and PT73H land 3 local days
  // and 73 exact hours later, the first an hour sooner. P3D's wall clock is past
  // +275760-09-13T00:00 local in a zone ahead of UTC, but its exact time is in range.
  it.each`
    relativeTo
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-10T09:00:00+14:00[Pacific/Kiritimati]"}
  `("returns -1 for P3D vs PT73H relative to $relativeTo", ({ relativeTo }) => {
    expect(compareDurations("P3D", "PT73H", { relativeTo })).toBe(-1);
  });
});

describe("compareDurations relative to the first days of the range", () => {
  // TC39 Duration.compare adds both to the anchor (min + 3d2h): -P3D lands 3 local days earlier and
  // -PT73H 73 exact hours earlier, so -P3D is the later (longer, as a signed value) one. -P3D's
  // wall clock is on the minimum's local date in a zone behind UTC, but in range.
  it.each`
    relativeTo
    ${"-271821-04-22T21:03:58-04:56[America/New_York]"}
    ${"-271821-04-22T15:28:34-10:31[Pacific/Honolulu]"}
  `(
    "returns 1 for -P3D vs -PT73H relative to $relativeTo",
    ({ relativeTo }) => {
      expect(compareDurations("-P3D", "-PT73H", { relativeTo })).toBe(1);
    },
  );
});

// S7: a non-ISO calendar `relativeTo` follows TC39 Duration.compare (DateDurationDays).
// Values: Chromium 153 native `Duration.compare(a, b, { relativeTo: PlainDate })`.
describe("compareDurations with a non-ISO calendar relativeTo (CORE-6)", () => {
  it.each`
    one               | two               | relativeTo                      | expected | reason
    ${"P1M"}          | ${"P29D"}         | ${"+275760-07-06[u-ca=hebrew]"} | ${1}     | ${"range limit: M07 of 279517 has 30 days"}
    ${"P1M"}          | ${"P30D"}         | ${"2023-08-31[u-ca=buddhist]"}  | ${0}     | ${"month-end overshoot: Aug 31 + 1 month is Sep 30, 30 days"}
    ${"P1M"}          | ${"P29D"}         | ${"-100000-01-01[u-ca=hebrew]"} | ${0}     | ${"hebrew year <= 0: M06 has 29 days"}
    ${"P1M"}          | ${"P1M"}          | ${"+275760-09-13[u-ca=hebrew]"} | ${0}     | ${"same fields: 0 before any arithmetic, though + P1M passes the limit"}
    ${"P4294967295M"} | ${"P4294967295M"} | ${"2024-01-15[u-ca=hebrew]"}    | ${0}     | ${"same fields: 0, though either sum passes the limit"}
    ${"P4294967295M"} | ${"P4294967294M"} | ${"2024-01-15[u-ca=hebrew]"}    | ${null}  | ${"different fields: the sums pass the limit, so null"}
  `(
    "compares $one with $two relative to $relativeTo as $expected ($reason)",
    ({ one, two, relativeTo, expected }) => {
      expect(compareDurations(one, two, { relativeTo })).toBe(expected);
    },
  );
});

// TC39 Duration.compare with a plain relativeTo adds only the years, months and weeks to the date
// (DateDurationDays). The days and the time are exact, and only their sum is checked against the
// largest time duration, 2^53 seconds less 1 nanosecond (Add24HourDaysToTimeDuration). So a day or
// time amount whose date would be past the range still compares. Values: Chromium 153 native
// `Duration.compare`.
describe("compareDurations with a plain relativeTo and a day or time amount past the range", () => {
  it.each`
    one                      | two                    | relativeTo                             | expected | reason
    ${"PT3000000000H"}       | ${"P1Y"}               | ${"2000-01-01"}                        | ${1}     | ${"the hours are never added to the date"}
    ${"PT3000000000H"}       | ${"P1Y"}               | ${"2000-01-01T12:00"}                  | ${1}     | ${"a date-time relativeTo drops its time"}
    ${"P1YT3000000000H"}     | ${"P385DT3000000000H"} | ${"2024-02-10[u-ca=hebrew]"}           | ${0}     | ${"P1Y from 1 Adar I 5784 is 385 days"}
    ${"P1YT3000000000H"}     | ${"P385DT3000000000H"} | ${"2024-02-10"}                        | ${-1}    | ${"P1Y from 2024-02-10 is 366 days"}
    ${"P104249991374D"}      | ${"P1Y"}               | ${"2000-01-01"}                        | ${1}     | ${"the most whole days a duration holds"}
    ${"PT9007199254740991S"} | ${"P1Y"}               | ${"2000-01-01"}                        | ${1}     | ${"the most whole seconds a duration holds"}
    ${"P1Y104249991008D"}    | ${"P1D"}               | ${"2000-01-01"}                        | ${1}     | ${"366 days of P1Y bring the days to the most a duration holds"}
    ${"-P1D"}                | ${"P1W"}               | ${"-271821-04-19"}                     | ${-1}    | ${"the day before the first date is never reached"}
    ${"-P1D"}                | ${"P1W"}               | ${"-271821-04-19[u-ca=gregory]"}       | ${-1}    | ${"a calendar-annotated first date"}
    ${"-P1D"}                | ${"P1W"}               | ${"-271821-04-19T00:00[u-ca=gregory]"} | ${-1}    | ${"a calendar-annotated first date-time drops its time"}
    ${"-P1D"}                | ${"P1W"}               | ${"-271821-04-19[u-ca=iso8601]"}       | ${-1}    | ${"an iso8601-annotated first date"}
    ${"P1D"}                 | ${"P2D"}               | ${"-271821-04-19[u-ca=gregory]"}       | ${-1}    | ${"no calendar unit, from a calendar-annotated first date"}
    ${"P1M"}                 | ${"P400D"}             | ${"+275760-08-13"}                     | ${-1}    | ${"P1M ends on the last date"}
    ${"-P1W"}                | ${"P1D"}               | ${"+275760-09-13"}                     | ${-1}    | ${"the day after the last date is never reached"}
    ${"-P1W"}                | ${"PT9000000000000S"}  | ${"2000-01-01"}                        | ${-1}    | ${"the seconds are never added to the date"}
    ${"P1Y104249991009D"}    | ${"P1D"}               | ${"2000-01-01"}                        | ${null}  | ${"one day more is past the largest time duration"}
    ${"P1M"}                 | ${"P1D"}               | ${"+275760-09-13"}                     | ${null}  | ${"P1M from the last date is past the range"}
    ${"-P1D"}                | ${"-P1W"}              | ${"-271821-04-19"}                     | ${null}  | ${"-P1W from the first date is past the range"}
  `(
    "compares $one with $two relative to $relativeTo as $expected ($reason)",
    ({ one, two, relativeTo, expected }) => {
      expect(compareDurations(one, two, { relativeTo })).toBe(expected);
    },
  );
});

// TC39 Duration.compare with a zoned relativeTo and a calendar unit adds the whole duration to it
// (AddZonedDateTime), so the hours do reach the date, and past the range it throws. Values:
// Node 26.12.1 native `Duration.compare`.
describe("compareDurations with a zoned relativeTo and an amount past the range", () => {
  it.each`
    one                | two      | expected | reason
    ${"PT3000000000H"} | ${"P1Y"} | ${null}  | ${"the hours are added to the date and pass the last date"}
    ${"P1W"}           | ${"P1D"} | ${1}     | ${"both dates are in range"}
  `(
    "compares $one with $two relative to 2000-01-01T00:00:00+00:00[UTC] as $expected ($reason)",
    ({ one, two, expected }) => {
      expect(
        compareDurations(one, two, {
          relativeTo: "2000-01-01T00:00:00+00:00[UTC]",
        }),
      ).toBe(expected);
    },
  );
});

describe("compareDurations with a relativeTo that is not a string", () => {
  it.each`
    relativeTo                           | label
    ${{ year: 2023, month: 2, day: 31 }} | ${"a bag with a day to clamp"}
    ${{ year: 2023, month: 2, day: 1 }}  | ${"a valid bag"}
  `("returns null for $label", ({ relativeTo }) => {
    expect(compareDurations("P1M", "P30D", { relativeTo })).toBeNull();
  });
});
