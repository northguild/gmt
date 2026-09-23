import { calendarZonedFixtures } from "../../test";
import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { convertZonedToZoned } from "../convert/convertZonedToZoned";
import { intervalLengthZoned } from "./intervalLengthZoned";

describe("intervalLengthZoned", () => {
  it.each`
    start                                            | end                                              | unit       | expected
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-11T00:00:00-04:00[America/New_York]"} | ${"hour"}  | ${23}
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-11T00:00:00-04:00[America/New_York]"} | ${"day"}   | ${1}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-04T00:00:00-05:00[America/New_York]"} | ${"hour"}  | ${25}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-04T00:00:00-05:00[America/New_York]"} | ${"day"}   | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-01-08T00:00:00+00:00[UTC]"}              | ${"week"}  | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-03-05T00:00:00+00:00[UTC]"}              | ${"month"} | ${2.129032258064516}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2025-01-01T00:00:00+00:00[UTC]"}              | ${"year"}  | ${1}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"2024-03-01T00:00:00+00:00[UTC]"}              | ${"day"}   | ${1}
  `(
    "returns $expected $unit for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthZoned(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start                               | end                                 | unit
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"}
  `(
    "returns 0 for zero-length $start to $end in $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(0);
    },
  );

  it.each`
    start                               | end                                 | unit
    ${"invalid"}                        | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthZoned(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end                                 | unit
    ${123}  | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${null} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthZoned(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalLengthZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "day",
      ),
    ).toBeNull();
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed real-time span measured in hours", () => {
    const startInstant = Temporal.Instant.from("2024-06-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-01T05:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalLengthZoned(start, end, "hour")).toBe(5);
    }
  });
  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (TC39 CalendarEquals makes until throw).
  it("returns null when start and end name different calendars", () => {
    expect(
      intervalLengthZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "day",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152), D5-zoned. Every expected value produced by running
// @js-temporal/polyfill@0.5.1 — see the R2 note below for why that matters more here than usual.
// ---------------------------------------------------------------------------------------------
// Temporal DifferenceTemporalZonedDateTime: a largestUnit of day or larger across two zones that are
// not TimeZoneEquals throws RangeError ("day lengths can vary between time zones"), so the calendar
// units are null; time units measure exact elapsed time. New York 2024-01-01T00:00-05:00 is 05:00Z
// and Paris 2024-01-03T00:00+01:00 is 2024-01-02T23:00Z: 42 hours apart.
describe("intervalLengthZoned across two time zones", () => {
  it.each`
    start                                            | end                                          | unit        | expected | why
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"hour"}   | ${42}    | ${"time unit: exact elapsed time"}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"minute"} | ${2520}  | ${"time unit: exact elapsed time"}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"day"}    | ${null}  | ${"calendar unit across zones"}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"week"}   | ${null}  | ${"calendar unit across zones"}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"month"}  | ${null}  | ${"calendar unit across zones"}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"years"}  | ${null}  | ${"calendar unit (plural) across zones"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-01-03T00:00:00+00:00[Etc/UTC]"}      | ${"day"}    | ${2}     | ${"UTC and Etc/UTC are TimeZoneEquals"}
    ${"2024-01-01T00:00:00+05:30[Asia/Calcutta]"}    | ${"2024-01-03T00:00:00+05:30[Asia/Kolkata]"} | ${"day"}    | ${2}     | ${"Asia/Calcutta links to Asia/Kolkata"}
  `(
    "$start → $end in $unit is $expected ($why)",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(expected);
    },
  );

  it("measures calendar units once both ends are in one zone (the compatibility path)", () => {
    // Paris 2024-01-03T00:00+01:00 is New York 2024-01-02T18:00-05:00: 42 hours, 1.75 days.
    expect(
      intervalLengthZoned(
        "2024-01-01T00:00:00-05:00[America/New_York]",
        convertZonedToZoned(
          "2024-01-03T00:00:00+01:00[Europe/Paris]",
          "America/New_York",
        ),
        "day",
      ),
    ).toBe(1.75);
  });
});

describe("intervalLengthZoned with GMT calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

  it("measures a Hebrew leap year as exactly 13 months", () => {
    expect(
      intervalLengthZoned(
        Y.tishri1_5784NewYork,
        Y.tishri1_5785NewYork,
        "month",
      ),
    ).toBe(13);
  });

  it("measures the same span as 383 Hebrew days", () => {
    expect(
      intervalLengthZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "day"),
    ).toBe(383);
  });

  // TC39 CalendarEquals — endpoints naming different calendars return null (native
  // Chromium 153 until: "Mismatched calendars."). The all-ISO control is polyfill-verified.
  it.each`
    label                       | start                    | end            | expected
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END} | ${null}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}    | ${null}
    ${"both bare ISO"}          | ${Y.isoStart}            | ${Y.isoEnd}    | ${12.566666666666666}
  `("returns $expected months for $label", ({ start, end, expected }) => {
    expect(intervalLengthZoned(start, end, "month")).toBe(expected);
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"-04:00 is not New York's offset on ISO 5784-01-01"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
  `("returns null when the start is $value ($reason)", ({ value }) => {
    expect(intervalLengthZoned(value, Y.isoEnd, "day")).toBeNull();
  });
});

describe("intervalLengthZoned at the maximum instant", () => {
  // Both intervals run from max - 3d5h to max - 1d. TC39 DifferenceZonedDateTime gives P2DT5H, and
  // NudgeToCalendarUnit totals it over the day from +275760-09-12 to the 13th: 2 + 5/24 days,
  // although that day's end wall clock is past +275760-09-13T00:00 in a zone ahead of UTC.
  it.each`
    start                                                 | end                                                   | unit      | expected
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}   | ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"}   | ${"day"}  | ${2.2083333333333335}
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"}   | ${"+275760-09-12T10:00:00+10:00[Australia/Sydney]"}   | ${"hour"} | ${53}
    ${"+275760-09-10T09:00:00+14:00[Pacific/Kiritimati]"} | ${"+275760-09-12T14:00:00+14:00[Pacific/Kiritimati]"} | ${"day"}  | ${2.2083333333333335}
    ${"+275760-09-05T23:00:00+00:00[UTC]"}                | ${"+275760-09-08T00:00:00+00:00[UTC]"}                | ${"day"}  | ${2.0416666666666665}
  `(
    "returns $expected $unit for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(expected);
    },
  );

  // TC39 NudgeToCalendarUnit: the day window after the end starts past the maximum, so Temporal
  // throws — in UTC too, whose exact times GetPossibleEpochNanoseconds validates like +00:00's.
  it.each`
    start                                                 | end
    ${"+275760-09-11T10:00:00+10:00[Australia/Sydney]"}   | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-11T14:00:00+14:00[Pacific/Kiritimati]"} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"+275760-09-10T23:00:00+00:00[UTC]"}                | ${"+275760-09-13T00:00:00+00:00[UTC]"}
    ${"+275760-09-10T23:00:00+00:00[+00:00]"}             | ${"+275760-09-13T00:00:00+00:00[+00:00]"}
    ${"+275760-09-11T00:00:00+01:00[Europe/London]"}      | ${"+275760-09-13T01:00:00+01:00[Europe/London]"}
  `("returns null in days for $start to $end", ({ start, end }) => {
    expect(intervalLengthZoned(start, end, "day")).toBeNull();
  });
});

// CORE-6 S5/S7: the length in a calendar unit is `Duration#total` relative to the start, which
// follows TC39 DifferenceZonedDateTimeWithTotal in the start's calendar. Values: Chromium 153
// native `start.until(end, { largestUnit }).total({ unit, relativeTo: start })`; null where
// Chromium throws.
describe("intervalLengthZoned in non-ISO calendars (CORE-6)", () => {
  it.each`
    start                                               | end                                                 | unit        | expected              | reason
    ${"2023-08-31T00:00:00+00:00[UTC][u-ca=buddhist]"}  | ${"2023-09-30T00:00:00+00:00[UTC][u-ca=buddhist]"}  | ${"months"} | ${1}                  | ${"D6: the 1-month window ends exactly on the end"}
    ${"1000-01-31T00:00:00+00:00[UTC][u-ca=buddhist]"}  | ${"1000-02-28T00:00:00+00:00[UTC][u-ca=buddhist]"}  | ${"months"} | ${1}                  | ${"proleptic buddhist: Jan 31 + 1 month is Feb 28 in ISO 1000"}
    ${"-100000-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"-100000-02-10T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"months"} | ${1.3666666666666667} | ${"hebrew year <= 0: 1 month and 11 of M07's 30 days"}
    ${"+275760-07-06T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"months"} | ${null}               | ${"D1: the third month's window ends past the maximum"}
  `(
    "returns $expected $unit from $start to $end ($reason)",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(expected);
    },
  );
});
