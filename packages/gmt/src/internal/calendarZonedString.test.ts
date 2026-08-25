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
  // DoD-1: the grammar must survive a full parse -> format round trip for every supported
  // calendar in every battle-test zone — 13 x 20 = 260 cases. Exhaustive here (rather than
  // sampled) because the round trip is cheap and is precisely where a calendar-specific
  // formatting bug would hide.
  it.each(
    sameInstantZonedCases.flatMap(({ timeZone, value }) =>
      allCalendars.map((calendar) => ({ timeZone, value, calendar })),
    ),
  )(
    "round-trips $calendar in $timeZone back to the original ISO value",
    ({ value, calendar }) => {
      const annotated = convertZonedToCalendar(value, calendar);
      expect(annotated).not.toBe("");

      const reparsed = parseCalendarZonedValue(annotated);
      expect(reparsed.toInstant().toString()).toBe(
        Temporal.ZonedDateTime.from(value).toInstant().toString(),
      );
      expect(formatZonedInCalendar(reparsed, "gregorian")).toBe(value);
    },
  );

  // The two era-bearing calendars named explicitly in E7's definition of done — the era suffix is
  // the part of the grammar that can never round-trip through Temporal directly (`;era=` is not
  // valid RFC 9557 at any segment ordering), so it gets its own named rows rather than only
  // living inside the 260-case sweep above.
  it.each`
    value                                              | calendar      | expected
    ${"2024-10-03T14:30:45+00:00[UTC]"}                | ${"japanese"} | ${"0006-10-03T14:30:45+00:00[u-ca=japanese;era=reiwa][UTC]"}
    ${"2024-10-03T14:30:45+03:00[Africa/Addis_Ababa]"} | ${"ethiopic"} | ${"2017-01-23T14:30:45+03:00[u-ca=ethiopic;era=ethiopic][Africa/Addis_Ababa]"}
  `(
    "formats the era-bearing $calendar value as $expected",
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
    value                                                                      | calendar                 | expected
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}              | ${"hebrew"}              | ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}
    ${"7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]"} | ${"ethiopic-amete-alem"} | ${"7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                           | ${"gregorian"}           | ${"2024-10-03T14:30:45-04:00[America/New_York]"}
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

  // formatZonedInCalendar is the ONLY writer of the annotated zoned grammar. These two rows pin
  // the reason: Temporal's own stringifiers emit the opposite segment ordering, which GMT rejects.
  it("never emits Temporal's [timeZone][u-ca=...] ordering, which Temporal's own toString does", () => {
    const heb = parseCalendarZonedValue(
      calendarZonedFixtures.hebrewLeapMonth.adarI15NewYork,
    );

    expect(heb.toString()).toBe(
      "2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]",
    );
    expect(heb.toPlainDateTime().toString()).toBe(
      "2024-02-24T14:30:00[u-ca=hebrew]",
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
    value                                                                    | reason
    ${"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]"}            | ${"Temporal's RFC 9557 segment ordering"}
    ${"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}            | ${"GMT digits in RFC 9557 ordering (the misparse hazard)"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew]"}                              | ${"no time zone segment"}
    ${"5784-06-15[u-ca=hebrew]"}                                             | ${"plain calendar date, no time or zone"}
    ${"5784-06-15T14:30:00-05:00[u-ca=martian][America/New_York]"}           | ${"unknown calendar identifier"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][Not/AZone]"}                   | ${"unknown time zone"}
    ${"0031-04-30T12:00:00+09:00[u-ca=japanese;era=nosucherra][Asia/Tokyo]"} | ${"unknown era"}
    ${"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}            | ${"month 13 in a non-leap Hebrew year"}
    ${"5784-06-15T14:30:00+03:00[u-ca=hebrew][America/New_York]"}            | ${"stale offset for the named zone"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                                      | ${"leap second, which Temporal would otherwise clamp to :59"}
    ${"invalid"}                                                             | ${"not a datetime at all"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => parseCalendarZonedValue(value)).toThrow();
  });

  // The regression trap for an over-eager regex or field check that assumes month <= 12: Hebrew
  // 5784 IS a leap year, so month 13 genuinely exists and must parse.
  it("accepts month 13 in the Hebrew leap year 5784 even though 5785 rejects it", () => {
    expect(
      parseCalendarZonedValue(
        "5784-13-15T14:30:00-04:00[u-ca=hebrew][America/New_York]",
      ).calendarId,
    ).toBe("hebrew");
    expect(() =>
      parseCalendarZonedValue(
        "5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]",
      ),
    ).toThrow();
  });

  it("passes disambiguation through to Temporal for a fold landing", () => {
    // Morocco's 2019-05-05 fall-back fold — the same fixture the Japanese era tests use.
    const earlier = parseCalendarZonedValue(
      "0001-05-05T02:30:00[u-ca=japanese;era=reiwa][Africa/Casablanca]",
      { disambiguation: "earlier" },
    );
    const later = parseCalendarZonedValue(
      "0001-05-05T02:30:00[u-ca=japanese;era=reiwa][Africa/Casablanca]",
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
    expect(formatZonedInCalendar(bare, "gregorian")).toBe(
      "2024-10-03T14:30:45-04:00[America/New_York]",
    );
  });
});
