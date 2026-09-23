import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, MustTestCalendars } from "../../test";
import type { CalendarSystem } from "../../types";
import {
  addZonedBusinessDays,
  cycleZoned,
  endOfZoned,
  roundZoned,
  setZoned,
  startOfZoned,
  subtractZonedBusinessDays,
} from "../calculate";
import {
  convertZonedToCalendar,
  convertZonedToPlainDateTime,
  convertZonedToUnix,
  convertZonedToUtc,
} from "../convert";
import { formatZonedDateTime } from "../format";
import { parseDateFromZoned, parseYearFromZoned } from "../parse";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { isValidCalendarZonedDateTime } from "./isValidCalendarZonedDateTime";
import { isValidZonedDateTime } from "./isValidZonedDateTime";

const ANNOTATED = "2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]";
const BARE = "2024-02-24T14:30:00-05:00[America/New_York]";

describe("isValidCalendarZonedDateTime", () => {
  it.each`
    value                                                                      | reason
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                           | ${"bare ISO zoned string"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}                                    | ${"bare ISO with fractional seconds"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}              | ${"RFC 9557 calendar-annotated"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]"}                  | ${"era-based calendar, no era in the string"}
    ${"2024-10-03T14:30:45+03:00[Africa/Addis_Ababa][u-ca=ethiopic]"}          | ${"ethiopic"}
    ${"2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]"}             | ${"ethioaa"}
    ${"5784-01-01T14:30:00-05:00[America/New_York][!u-ca=hebrew]"}             | ${"ISO year 5784 with a critical calendar annotation"}
    ${"2024-03-10T14:30:00-04:00[!America/New_York][!u-ca=hebrew]"}            | ${"critical zone and critical calendar"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=HEBREW]"}              | ${"calendar id in upper case (CanonicalizeCalendar folds it)"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew][u-ca=roc]"}    | ${"a second elective calendar annotation is ignored"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][foo=bar][u-ca=hebrew]"}     | ${"elective unknown annotation is ignored"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethiopic-amete-alem]"} | ${"alias of ethioaa"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=gregory]"}             | ${"gregory"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=iso8601]"}             | ${"explicit iso8601"}
    ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=hebrew]"}                        | ${"the maximum instant"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidCalendarZonedDateTime(value)).toBe(true);
  });

  it.each`
    value                                                                    | reason
    ${"2024-03-10T14:30:00-04:00[u-ca=hebrew][America/New_York]"}            | ${"calendar before zone (not RFC 9557; Temporal rejects it)"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]"}     | ${"';era=' is not RFC 9557 syntax"}
    ${"279517-10-11T14:30:00-05:00[America/New_York][u-ca=hebrew]"}          | ${"six-digit unsigned year"}
    ${"2024-02-24T14:30:00-05:00[u-ca=hebrew]"}                              | ${"no time zone, which is zoned/'s grammar requirement"}
    ${"2024-02-24[u-ca=hebrew]"}                                             | ${"a plain calendar date, which is plain/'s grammar"}
    ${"2024-10-03T14:30:45[u-ca=hebrew]"}                                    | ${"calendar-annotated PlainDateTime, which has no GMT grammar"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=martian]"}           | ${"unknown calendar identifier"}
    ${"2024-02-24T14:30:00-05:00[Not/AZone][u-ca=hebrew]"}                   | ${"unknown time zone"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}            | ${"ISO month 13 (the digits are ISO)"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][!u-ca=hebrew][u-ca=roc]"} | ${"second calendar annotation after a critical one"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][!foo=bar][u-ca=hebrew]"}  | ${"unknown critical annotation"}
    ${"2024-02-24T14:30:00+03:00[America/New_York][u-ca=hebrew]"}            | ${"stale offset that does not match the named zone"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                                      | ${"leap second, which Temporal would otherwise clamp to :59"}
    ${"2024-02-24T14:30:60-05:00[America/New_York][u-ca=hebrew]"}            | ${"leap second inside the annotated grammar"}
    ${"invalid"}                                                             | ${"not a datetime at all"}
    ${""}                                                                    | ${"empty string"}
    ${"20240224T143000-0500[America/New_York][u-ca=hebrew]"}                 | ${"basic format (strict extended shape)"}
    ${"2024-02-24 14:30:00-05:00[America/New_York][u-ca=hebrew]"}            | ${"space separator (strict extended shape)"}
    ${"2024-02-24t14:30:00-05:00[America/New_York]"}                         | ${"lower-case t separator (strict extended shape)"}
    ${"2024-02-24T19:30:00z[America/New_York][u-ca=hebrew]"}                 | ${"lower-case z designator (strict extended shape)"}
    ${"2024-02-24[America/New_York][u-ca=hebrew]"}                           | ${"date without a time (strict extended shape)"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isValidCalendarZonedDateTime(value)).toBe(false);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns false when $value is non-string input", ({ value }) => {
    expect(isValidCalendarZonedDateTime(value as unknown as string)).toBe(
      false,
    );
  });

  // DoD-5: the full battle-test zone matrix, built by mapping the shared zone list rather than
  // hand-picking — this is what covers Kathmandu (+05:45), Chatham (+12:45/+13:45), Lord Howe
  // (+10:30/+11:00), Apia (+13:00) and Niue (-11:00).
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      value: convertZonedToCalendar(
        Temporal.Instant.from("2024-10-03T14:30:45Z")
          .toZonedDateTimeISO(timeZone)
          .toString(),
        "hebrew",
      ),
    })),
  )("accepts the Hebrew-annotated value $value in $timeZone", ({ value }) => {
    expect(value).not.toBe("");
    expect(isValidCalendarZonedDateTime(value)).toBe(true);
  });

  // The calendar must be one GMT supports.
  it.each`
    value                                                  | reason
    ${"2024-01-10T12:00:00+00:00[UTC][u-ca=islamic]"}      | ${"not in the proposal's calendar table"}
    ${"2024-01-10T12:00:00+00:00[UTC][u-ca=islamic-rgsa]"} | ${"not in the proposal's calendar table"}
    ${"2024-01-10T12:00:00+00:00[UTC][u-ca=chinese]"}      | ${"not supported by GMT"}
    ${"2024-01-10T12:00:00+00:00[UTC][u-ca=gregorian]"}    | ${"CLDR alias Temporal does not accept"}
    ${"2024-01-10T12:00:00+00:00[UTC][u-ca=taiwan]"}       | ${"pre-1.16.0 GMT id"}
  `(
    "returns false for the unsupported calendar id in $value ($reason)",
    ({ value }) => {
      expect(isValidCalendarZonedDateTime(value)).toBe(false);
    },
  );

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(isValidCalendarZonedDateTime(BARE)).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws for an annotated value", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(isValidCalendarZonedDateTime(ANNOTATED)).toBe(false);
  });

  it.each(Object.values(MustTestCalendars).map((calendar) => ({ calendar })))(
    "accepts convertZonedToCalendar's own output for $calendar",
    ({ calendar }) => {
      const value = convertZonedToCalendar(BARE, calendar as CalendarSystem);
      expect(value).not.toBe("");
      expect(isValidCalendarZonedDateTime(value)).toBe(true);
    },
  );
});

// This is the table that pins E7's Q2 decision: `isValidZonedDateTime` was NOT loosened,
// so the ~72 `zoned/` functions outside E7's scope must keep refusing the new grammar. If one of
// them ever starts accepting it without the rest of E7's machinery, it would silently compute a
// Gregorian answer for a value that visibly asked for a different calendar. Treat this table as
// load-bearing, not incidental.
describe("out-of-scope zoned functions still reject the E7 calendar grammar", () => {
  it("isValidZonedDateTime keeps rejecting the annotation it rejected before E7", () => {
    expect(isValidZonedDateTime(ANNOTATED)).toBe(false);
    expect(isValidZonedDateTime(BARE)).toBe(true);
    // ...while the parallel validator accepts both.
    expect(isValidCalendarZonedDateTime(ANNOTATED)).toBe(true);
    expect(isValidCalendarZonedDateTime(BARE)).toBe(true);
  });

  it.each`
    name                             | call                                                      | sentinel
    ${"parseDateFromZoned"}          | ${(v: string) => parseDateFromZoned(v)}                   | ${""}
    ${"parseYearFromZoned"}          | ${(v: string) => parseYearFromZoned(v)}                   | ${""}
    ${"convertZonedToUtc"}           | ${(v: string) => convertZonedToUtc(v)}                    | ${""}
    ${"convertZonedToUnix"}          | ${(v: string) => convertZonedToUnix(v)}                   | ${null}
    ${"convertZonedToPlainDateTime"} | ${(v: string) => convertZonedToPlainDateTime(v)}          | ${""}
    ${"formatZonedDateTime"}         | ${(v: string) => formatZonedDateTime(v, "en-US")}         | ${""}
    ${"roundZoned"}                  | ${(v: string) => roundZoned(v, { smallestUnit: "hour" })} | ${""}
    ${"setZoned"}                    | ${(v: string) => setZoned(v, { hour: 9 })}                | ${""}
    ${"startOfZoned"}                | ${(v: string) => startOfZoned(v, "day")}                  | ${""}
    ${"endOfZoned"}                  | ${(v: string) => endOfZoned(v, "day")}                    | ${""}
    ${"cycleZoned"}                  | ${(v: string) => cycleZoned(v, "month", 1)}               | ${""}
    ${"addZonedBusinessDays"}        | ${(v: string) => addZonedBusinessDays(v, 1)}              | ${""}
    ${"subtractZonedBusinessDays"}   | ${(v: string) => subtractZonedBusinessDays(v, 1)}         | ${""}
  `(
    "$name returns its sentinel for a calendar-annotated value but succeeds on the bare ISO control",
    ({ call, sentinel }) => {
      const fn = call as (v: string) => unknown;
      expect(fn(ANNOTATED)).toBe(sentinel);
      expect(fn(BARE)).not.toBe(sentinel);
    },
  );

  // D9 is explicitly unaffected by E7: day-of-week is ISO-fixed in every supported calendar, so a
  // calendar tag would change nothing about a business-day answer while implying it might.
  it("keeps the business-day pair on the old validator per D9", () => {
    expect(addZonedBusinessDays(ANNOTATED, 1)).toBe("");
    expect(subtractZonedBusinessDays(ANNOTATED, 1)).toBe("");
  });
});
