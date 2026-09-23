import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  calendarZonedFixtures,
  MustTestCalendars,
} from "../test";
import type { CalendarSystem } from "../types";
import { convertZonedToCalendar } from "../zoned/convert/convertZonedToCalendar";
import {
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "./calendarZonedString";

const allCalendars = Object.values(MustTestCalendars);

// A single fixed instant, re-expressed in every battle-test zone. Built by mapping the shared
// zone matrix rather than hand-picking zones, so the exotic offsets (+05:45 Kathmandu,
// +12:45/+13:45 Chatham, +10:30/+11:00 Lord Howe, +13:00 Apia, -11:00 Niue) are all covered.
const sameInstantZonedCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.Instant.from("2024-10-03T14:30:45Z")
    .toZonedDateTimeISO(timeZone)
    .toString(),
}));

describe("parseCalendarZonedValue / formatZonedInCalendar", () => {
  // The grammar survives a full parse -> format round trip for every supported calendar in every
  // battle-test zone, and the annotated string is exactly Temporal's own ZonedDateTime#toString.
  it.each(
    sameInstantZonedCases.flatMap(({ timeZone, value }) =>
      allCalendars.map((calendar) => ({ timeZone, value, calendar })),
    ),
  )(
    "round-trips $calendar in $timeZone back to the original ISO value",
    ({ value, calendar }) => {
      const annotated = convertZonedToCalendar(value, calendar);
      expect(annotated).toBe(
        Temporal.ZonedDateTime.from(value).withCalendar(calendar).toString(),
      );

      const reparsed = parseCalendarZonedValue(annotated);
      expect(reparsed.toInstant().toString()).toBe(
        Temporal.ZonedDateTime.from(value).toInstant().toString(),
      );
      expect(formatZonedInCalendar(reparsed, "iso8601")).toBe(value);
    },
  );

  // The era-based calendars: no era in the string, the calendar annotation after the zone.
  // Expected values: native Temporal (Chromium 153), ZonedDateTime#withCalendar(calendar).toString().
  it.each`
    value                                              | calendar      | expected
    ${"2024-10-03T14:30:45+00:00[UTC]"}                | ${"japanese"} | ${"2024-10-03T14:30:45+00:00[UTC][u-ca=japanese]"}
    ${"2024-10-03T14:30:45+03:00[Africa/Addis_Ababa]"} | ${"ethiopic"} | ${"2024-10-03T14:30:45+03:00[Africa/Addis_Ababa][u-ca=ethiopic]"}
  `(
    "formats the era-based $calendar value as $expected",
    ({ value, calendar, expected }) => {
      expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(
        formatZonedInCalendar(
          parseCalendarZonedValue(expected),
          calendar as CalendarSystem,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    value                                                          | calendar     | expected
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}  | ${"hebrew"}  | ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}
    ${"2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]"} | ${"ethioaa"} | ${"2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]"}
    ${"2025-09-05T00:30:00-04:00[America/Santiago][u-ca=coptic]"}  | ${"coptic"}  | ${"2025-09-05T00:30:00-04:00[America/Santiago][u-ca=coptic]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}               | ${"iso8601"} | ${"2024-10-03T14:30:45-04:00[America/New_York]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=iso8601]"} | ${"iso8601"} | ${"2024-10-03T14:30:45-04:00[America/New_York]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][!u-ca=HEBREW]"} | ${"hebrew"}  | ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"}
  `(
    "re-formats parsed $value in $calendar as $expected",
    ({ value, calendar, expected }) => {
      expect(
        formatZonedInCalendar(
          parseCalendarZonedValue(value),
          calendar as CalendarSystem,
        ),
      ).toBe(expected);
    },
  );

  // The annotated zoned grammar is Temporal's own ZonedDateTime#toString.
  it("writes the same string as Temporal's own toString", () => {
    const heb = parseCalendarZonedValue(
      calendarZonedFixtures.hebrewLeapMonth.adarI15NewYork,
    );

    expect(heb.toString()).toBe(
      "2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]",
    );

    expect(formatZonedInCalendar(heb, "hebrew")).toBe(
      calendarZonedFixtures.hebrewLeapMonth.adarI15NewYork,
    );
  });

  it("re-calendars an iso8601-calendared value rather than emitting it unannotated", () => {
    // Boundary points synthesized by `Instant.prototype.toZonedDateTimeISO` are always iso8601.
    const synthesized = Temporal.Instant.from("2024-02-24T19:30:00Z")
      .toZonedDateTimeISO("America/New_York")
      .withCalendar("iso8601");

    expect(formatZonedInCalendar(synthesized, "hebrew")).toBe(
      calendarZonedFixtures.hebrewLeapMonth.adarI15NewYork,
    );
  });

  it.each`
    value                                                                       | reason
    ${"2024-03-10T14:30:00-04:00[u-ca=hebrew][America/New_York]"}               | ${"calendar before zone (not RFC 9557; Temporal rejects it)"}
    ${"2024-02-24T14:30:00-05:00[u-ca=hebrew]"}                                 | ${"no time zone segment"}
    ${"2024-02-24[u-ca=hebrew]"}                                                | ${"plain calendar date, no time or zone"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=martian]"}              | ${"unknown calendar identifier"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=chinese]"}              | ${"calendar GMT does not support"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=taiwan]"}               | ${"pre-1.16.0 GMT id"}
    ${"279517-10-11T14:30:00-05:00[America/New_York][u-ca=hebrew]"}             | ${"six-digit unsigned year"}
    ${"2024-02-24T14:30:00-05:00[Not/AZone][u-ca=hebrew]"}                      | ${"unknown time zone"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]"}        | ${"';era=' is not RFC 9557 syntax"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}               | ${"ISO month 13 (the digits are ISO)"}
    ${"2024-02-24T14:30:00+03:00[America/New_York][u-ca=hebrew]"}               | ${"stale offset for the named zone"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                                         | ${"leap second, which Temporal would otherwise clamp to :59"}
    ${"2016-12-31t23:59:60+00:00[UTC]"}                                         | ${"leap second, lowercase t separator"}
    ${"2016-12-31 23:59:60+00:00[UTC]"}                                         | ${"leap second, space separator"}
    ${"20161231T235960Z[UTC]"}                                                  | ${"leap second, basic format"}
    ${"invalid"}                                                                | ${"not a datetime at all"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][!foo=bar][u-ca=hebrew]"}     | ${"unknown critical annotation"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][!u-ca=hebrew][u-ca=roc]"}    | ${"second calendar after a critical one"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew][!u-ca=roc]"}    | ${"critical second calendar"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=chinese][u-ca=hebrew]"} | ${"the first calendar is one GMT does not support"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][Asia/Tokyo][u-ca=hebrew]"}   | ${"two time zone annotations"}
    ${"20240224T143000-0500[America/New_York][u-ca=hebrew]"}                    | ${"basic format (strict extended shape)"}
    ${"2024-02-24 14:30:00-05:00[America/New_York][u-ca=hebrew]"}               | ${"space separator (strict extended shape)"}
    ${"2024-02-24t14:30:00-05:00[America/New_York][u-ca=hebrew]"}               | ${"lower-case t separator (strict extended shape)"}
    ${"2024-02-24T19:30:00z[America/New_York][u-ca=hebrew]"}                    | ${"lower-case z designator (strict extended shape)"}
    ${"2024-02-24T14:30:00-05[America/New_York][u-ca=hebrew]"}                  | ${"hour-only offset (strict extended shape)"}
    ${"2024-09-18[America/New_York][u-ca=hebrew]"}                              | ${"date without a time (strict extended shape)"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => parseCalendarZonedValue(value)).toThrow();
  });

  it.each`
    value                                                                   | calendarId
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=hebrew]"}           | ${"hebrew"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=ethiopic]"}         | ${"ethioaa"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=islamicc]"}         | ${"islamic-civil"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][foo=bar][u-ca=hebrew]"}  | ${"hebrew"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=hebrew][foo=bar]"}  | ${"hebrew"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=hebrew][u-ca=roc]"} | ${"hebrew"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][u-ca=coptic][foo=bar]"}  | ${"ethioaa"}
    ${"2024-09-18T14:30:00-04:00[America/New_York][foo=bar]"}               | ${"iso8601"}
  `("parses $value, computing in $calendarId", ({ value, calendarId }) => {
    expect(parseCalendarZonedValue(value).calendarId).toBe(calendarId);
  });

  it("passes disambiguation through to Temporal for a fold landing", () => {
    // Morocco's 2019-05-05 fall-back fold — the same fixture the Japanese era tests use.
    const earlier = parseCalendarZonedValue(
      "2019-05-05T02:30:00[Africa/Casablanca][u-ca=japanese]",
      { disambiguation: "earlier" },
    );
    const later = parseCalendarZonedValue(
      "2019-05-05T02:30:00[Africa/Casablanca][u-ca=japanese]",
      { disambiguation: "later" },
    );

    expect(earlier.offset).toBe("+01:00");
    expect(later.offset).toBe("+00:00");
  });

  it("parses a bare ISO zoned string unchanged and reports the iso8601 calendar", () => {
    const bare = parseCalendarZonedValue(
      "2024-10-03T14:30:45-04:00[America/New_York]",
    );
    expect(bare.calendarId).toBe("iso8601");
    expect(formatZonedInCalendar(bare, "iso8601")).toBe(
      "2024-10-03T14:30:45-04:00[America/New_York]",
    );
  });
});

describe("parseCalendarZonedValue at the maximum instant", () => {
  // 10:00 +10:00 on +275760-09-13 in Sydney is the last representable instant (Temporal
  // nsMaxInstant, 8.64e21 ns).
  it.each`
    value                                                             | calendarId   | epochNanoseconds
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney][u-ca=persian]"} | ${"persian"} | ${8_640_000_000_000_000_000_000n}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}               | ${"iso8601"} | ${8_640_000_000_000_000_000_000n}
  `(
    "parses $value to the $calendarId instant $epochNanoseconds",
    ({ value, calendarId, epochNanoseconds }) => {
      const zoned = parseCalendarZonedValue(value);
      expect(zoned.epochNanoseconds).toBe(epochNanoseconds);
      expect(zoned.calendarId).toBe(calendarId);
    },
  );
});
