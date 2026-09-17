import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, MustTestCalendars } from "../../test";
import type { CalendarSystem } from "../../types";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { convertZonedToCalendar } from "./convertZonedToCalendar";

const BASE = "2024-10-03T14:30:45-04:00[America/New_York]";

describe("convertZonedToCalendar", () => {
  it.each`
    calendar              | expected
    ${"iso8601"}          | ${"2024-10-03T14:30:45-04:00[America/New_York]"}
    ${"hebrew"}           | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"}
    ${"islamic-civil"}    | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-civil]"}
    ${"islamic-tbla"}     | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-tbla]"}
    ${"islamic-umalqura"} | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-umalqura]"}
    ${"japanese"}         | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=japanese]"}
    ${"buddhist"}         | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=buddhist]"}
    ${"roc"}              | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=roc]"}
    ${"persian"}          | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=persian]"}
    ${"indian"}           | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=indian]"}
    ${"ethiopic"}         | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethiopic]"}
    ${"ethioaa"}          | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethioaa]"}
    ${"coptic"}           | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=coptic]"}
  `(
    "converts the base value to $calendar as $expected",
    ({ calendar, expected }) => {
      expect(convertZonedToCalendar(BASE, calendar as CalendarSystem)).toBe(
        expected,
      );
    },
  );

  // Every calendar: the output is exactly Temporal's own ZonedDateTime#toString for the same
  // instant, zone and calendar, and it chains back to the original bare ISO value.
  it.each(Object.values(MustTestCalendars).map((calendar) => ({ calendar })))(
    "writes $calendar as Temporal.ZonedDateTime#toString and chains back to the original bare ISO value",
    ({ calendar }) => {
      const annotated = convertZonedToCalendar(
        BASE,
        calendar as CalendarSystem,
      );
      expect(annotated).toBe(
        Temporal.ZonedDateTime.from(BASE).withCalendar(calendar).toString(),
      );
      expect(convertZonedToCalendar(annotated, "iso8601")).toBe(BASE);
    },
  );

  // The TC39 maximum instant in every calendar (test262 extreme-dates.js max date).
  it.each`
    calendar              | expected
    ${"hebrew"}           | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=hebrew]"}
    ${"buddhist"}         | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=buddhist]"}
    ${"islamic-civil"}    | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=islamic-civil]"}
    ${"islamic-tbla"}     | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=islamic-tbla]"}
    ${"islamic-umalqura"} | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=islamic-umalqura]"}
    ${"persian"}          | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=persian]"}
    ${"indian"}           | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=indian]"}
    ${"japanese"}         | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=japanese]"}
    ${"roc"}              | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=roc]"}
    ${"ethioaa"}          | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=ethioaa]"}
    ${"coptic"}           | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=coptic]"}
    ${"ethiopic"}         | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=ethiopic]"}
  `(
    "converts the maximum instant to $calendar as $expected and back",
    ({ calendar, expected }) => {
      const max = "+275760-09-13T00:00:00+00:00[UTC]";
      expect(convertZonedToCalendar(max, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "iso8601")).toBe(max);
    },
  );

  // The TC39 minimum instant in UTC, whose date is -271821-04-20 (minimum + 1 day).
  it.each`
    calendar              | expected
    ${"iso8601"}          | ${"-271821-04-20T00:00:00+00:00[UTC]"}
    ${"islamic-civil"}    | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=islamic-civil]"}
    ${"islamic-tbla"}     | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=islamic-tbla]"}
    ${"islamic-umalqura"} | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=islamic-umalqura]"}
    ${"persian"}          | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=persian]"}
    ${"roc"}              | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=roc]"}
    ${"ethioaa"}          | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=ethioaa]"}
    ${"coptic"}           | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=coptic]"}
    ${"ethiopic"}         | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=ethiopic]"}
    ${"buddhist"}         | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=buddhist]"}
    ${"hebrew"}           | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=hebrew]"}
    ${"indian"}           | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=indian]"}
    ${"japanese"}         | ${"-271821-04-20T00:00:00+00:00[UTC][u-ca=japanese]"}
  `(
    "converts the minimum instant in UTC to $calendar as $expected and back",
    ({ calendar, expected }) => {
      const min = "-271821-04-20T00:00:00+00:00[UTC]";
      expect(convertZonedToCalendar(min, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "iso8601")).toBe(min);
    },
  );

  // The CORE-6 far-past rows (buddhist before 1582, hebrew years <= 0, indian before ISO year 1,
  // japanese before 1873): the string is the ISO instant plus the annotation.
  it.each`
    value                                  | calendar      | expected
    ${"1000-01-01T00:00:00+00:00[UTC]"}    | ${"buddhist"} | ${"1000-01-01T00:00:00+00:00[UTC][u-ca=buddhist]"}
    ${"-100000-01-01T00:00:00+00:00[UTC]"} | ${"hebrew"}   | ${"-100000-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"}
    ${"-000500-06-15T00:00:00+00:00[UTC]"} | ${"indian"}   | ${"-000500-06-15T00:00:00+00:00[UTC][u-ca=indian]"}
    ${"1800-01-01T00:00:00+00:00[UTC]"}    | ${"japanese"} | ${"1800-01-01T00:00:00+00:00[UTC][u-ca=japanese]"}
    ${"-000500-06-15T00:00:00+00:00[UTC]"} | ${"japanese"} | ${"-000500-06-15T00:00:00+00:00[UTC][u-ca=japanese]"}
  `(
    "converts $value to $calendar as $expected and back",
    ({ value, calendar, expected }) => {
      expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "iso8601")).toBe(value);
    },
  );

  it.each`
    from          | to                 | expected
    ${"hebrew"}   | ${"islamic-civil"} | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-civil]"}
    ${"japanese"} | ${"hebrew"}        | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"}
    ${"ethiopic"} | ${"coptic"}        | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=coptic]"}
    ${"ethioaa"}  | ${"japanese"}      | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=japanese]"}
  `(
    "chains directly from $from to $to as $expected",
    ({ from, to, expected }) => {
      const intermediate = convertZonedToCalendar(BASE, from as CalendarSystem);
      expect(convertZonedToCalendar(intermediate, to as CalendarSystem)).toBe(
        expected,
      );
    },
  );

  // DoD-5: mapped over the shared zone matrix rather than hand-picked, so the exotic offsets are
  // all exercised — Kathmandu +05:45, Chatham +12:45/+13:45, Lord Howe +10:30/+11:00,
  // Apia +13:00, Niue -11:00.
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      value: Temporal.Instant.from("2024-10-03T14:30:45Z")
        .toZonedDateTimeISO(timeZone)
        .toString(),
    })),
  )(
    "preserves the instant, offset and zone when converting to hebrew in $timeZone",
    ({ timeZone, value }) => {
      const annotated = convertZonedToCalendar(value, "hebrew");

      // RFC 9557 §4.1 order: the time zone annotation, then the calendar annotation.
      expect(annotated).toBe(`${value}[u-ca=hebrew]`);
      expect(annotated.endsWith(`[${timeZone}][u-ca=hebrew]`)).toBe(true);
      expect(convertZonedToCalendar(annotated, "iso8601")).toBe(value);
    },
  );

  it.each`
    value                                                                     | calendar       | reason
    ${"2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]"}             | ${"iso8601"}   | ${"calendar before zone (not RFC 9557)"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=japanese;era=reiwa]"} | ${"iso8601"}   | ${"';era=' is not RFC 9557 syntax"}
    ${"279517-10-11T14:30:45-04:00[America/New_York][u-ca=hebrew]"}           | ${"iso8601"}   | ${"six-digit unsigned year"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=taiwan]"}             | ${"iso8601"}   | ${"pre-1.16.0 GMT id"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=chinese]"}            | ${"iso8601"}   | ${"calendar GMT does not support"}
    ${"2024-10-03[u-ca=hebrew]"}                                              | ${"hebrew"}    | ${"a plain calendar date, not a zoned value"}
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                          | ${"gregorian"} | ${"CLDR alias, not a calendar id"}
    ${"2024-10-03T14:30:45"}                                                  | ${"hebrew"}    | ${"a PlainDateTime with no zone"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                                       | ${"hebrew"}    | ${"leap second"}
    ${"invalid"}                                                              | ${"hebrew"}    | ${"not a datetime at all"}
  `('returns "" for $value ($reason)', ({ value, calendar }) => {
    expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe("");
  });

  it('returns "" for an unsupported calendar', () => {
    expect(
      convertZonedToCalendar(BASE, "martian" as unknown as CalendarSystem),
    ).toBe("");
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-string input', ({ value }) => {
    expect(convertZonedToCalendar(value as unknown as string, "hebrew")).toBe(
      "",
    );
  });

  it('returns "" when Temporal.ZonedDateTime.from throws', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(convertZonedToCalendar(BASE, "hebrew")).toBe("");
  });

  it('returns "" when Temporal.ZonedDateTime.from throws for an annotated value', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      convertZonedToCalendar(
        "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]",
        "iso8601",
      ),
    ).toBe("");
  });
});

// CORE-6 §4.1 at the minimum instant behind UTC. The instant -271821-04-20T00:00Z is valid, but its
// local date -271821-04-19 is 10^8 + 1 days before the epoch, and TC39 InterpretISODateTimeOffset
// runs CheckISODaysRange on that local date whenever the string carries an offset under the default
// `offset: "reject"`. So TC39 (and Chromium 153) accept the wall clock alone and reject the same
// wall clock with its offset: the offset-bearing min strings are "" in both directions, while an
// offset-less string resolves. Dates: test262 extreme-dates.js min rows.
describe("convertZonedToCalendar at the minimum instant behind UTC (CORE-6)", () => {
  it.each`
    calendar              | expected
    ${"iso8601"}          | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}
    ${"hebrew"}           | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}
    ${"buddhist"}         | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}
    ${"islamic-civil"}    | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-civil]"}
    ${"islamic-tbla"}     | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-tbla]"}
    ${"islamic-umalqura"} | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-umalqura]"}
    ${"persian"}          | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=persian]"}
    ${"indian"}           | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=indian]"}
    ${"roc"}              | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=roc]"}
    ${"japanese"}         | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=japanese]"}
    ${"ethioaa"}          | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=ethioaa]"}
    ${"coptic"}           | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=coptic]"}
    ${"ethiopic"}         | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=ethiopic]"}
  `(
    "converts the offset-less minimum wall clock in Etc/GMT+12 to $calendar as $expected",
    ({ calendar, expected }) => {
      expect(
        convertZonedToCalendar(
          "-271821-04-19T12:00:00[Etc/GMT+12]",
          calendar as CalendarSystem,
        ),
      ).toBe(expected);
    },
  );

  // Temporal TemporalZonedDateTimeToString writes the offset with FormatDateTimeUTCOffsetRounded:
  // local mean time -04:56:02 is written -04:56 (Chromium 153 agrees).
  it("converts the offset-less minimum wall clock in America/New_York to hebrew in local mean time, offset rounded to the minute", () => {
    expect(
      convertZonedToCalendar(
        "-271821-04-19T19:03:58[America/New_York]",
        "hebrew",
      ),
    ).toBe("-271821-04-19T19:03:58-04:56[America/New_York][u-ca=hebrew]");
  });

  it.each`
    value                                                               | calendar
    ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}                       | ${"hebrew"}
    ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}                       | ${"iso8601"} | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"} | ${"iso8601"} | ${"-271821-04-19T19:03:58-04:56:02[America/New_York]"} | ${"hebrew"}
    ${"-271821-04-19T19:03:58-04:56:02[America/New_York][u-ca=hebrew]"} | ${"iso8601"}
  `(
    'returns "" converting $value to $calendar: its offset makes TC39 check the local date against the day range',
    ({ value, calendar }) => {
      expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe(
        "",
      );
    },
  );
});
