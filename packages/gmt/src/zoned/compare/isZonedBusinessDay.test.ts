import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { isZonedBusinessDay } from "./isZonedBusinessDay";

// Shared instant for local-day-boundary coverage: 2024-02-03T23:00:00Z is
// Saturday in UTC, but zones at a positive offset (Europe/Berlin eastward
// through Pacific/Chatham and Pacific/Apia) have already rolled to Sunday
// local time, while zones at a non-positive offset (Europe/Lisbon westward
// through Pacific/Niue) are still Saturday. This single instant, spread
// across every battle-test timeZone (UTC, half-hour/quarter-hour offsets,
// and the -11/+13/+13:45 extremes), exercises the "local day governs, not
// UTC day" boundary far beyond a single zone.

describe("isZonedBusinessDay", () => {
  // Full week boundary coverage — fixed ISO Monday–Friday business days.
  it.each`
    value                                            | expected
    ${"2024-02-02T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-03T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-04T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-05T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-06T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-07T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-08T10:00:00-05:00[America/New_York]"} | ${true}
  `(
    "returns $expected for $value (Mon–Fri business day)",
    ({ value, expected }) => {
      expect(isZonedBusinessDay(value)).toBe(expected);
    },
  );

  // Leap year edge cases — Feb 29 falls on different weekdays across years.
  it.each`
    value                                            | expected | description
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${true}  | ${"Thursday"}
    ${"2025-02-28T12:00:00-05:00[America/New_York]"} | ${true}  | ${"Friday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isZonedBusinessDay(value)).toBe(expected);
    },
  );

  // Year-boundary dates — extreme years that happen to fall on Mon/Fri.
  it.each`
    value                               | expected | description
    ${"0001-01-01T12:00:00+00:00[UTC]"} | ${true}  | ${"Monday"}
    ${"9999-12-31T12:00:00+00:00[UTC]"} | ${true}  | ${"Friday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isZonedBusinessDay(value)).toBe(expected);
    },
  );

  // Cross-year weekend consistency — Saturdays and Sundays in different years.
  it.each`
    value                               | expected | description
    ${"2025-01-04T12:00:00+00:00[UTC]"} | ${false} | ${"Saturday"}
    ${"2026-01-03T12:00:00+00:00[UTC]"} | ${false} | ${"Sunday"}
    ${"2025-01-05T12:00:00+00:00[UTC]"} | ${false} | ${"Sunday"}
  `("returns $expected for $value $description", ({ value, expected }) => {
    expect(isZonedBusinessDay(value)).toBe(expected);
  });

  // Invalid input — returns false
  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30T12:00:00+00:00[UTC]"}
    ${""}
    ${null}
    ${undefined}
    ${"not-a-date"}
    ${"2024/03/15T12:00:00+00:00[UTC]"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isZonedBusinessDay(value as never)).toBe(false);
  });

  // Invalid timezone — returns false
  it.each`
    value
    ${"2024-03-01T12:00:00+00:00[Invalid/Zone]"}
    ${"2024-03-01T12:00:00+00:00[NotA/Timezone]"}
  `("returns false for invalid timezone in $value", ({ value }) => {
    expect(isZonedBusinessDay(value)).toBe(false);
  });

  // Cross-timeZone coverage — same UTC instant, different local days
  it.each`
    utcInstant                | expectedInUtc | description
    ${"2024-02-03T23:00:00Z"} | ${false}      | ${"Saturday in UTC (rolls to Sunday in eastward zones)"}
    ${"2024-02-01T23:00:00Z"} | ${false}      | ${"Thursday in UTC (rolls to Friday in eastward zones)"}
  `(
    "returns $expectedInUtc for $utcInstant in UTC ($description)",
    ({ utcInstant, expectedInUtc }) => {
      expect(isZonedBusinessDay(utcInstant)).toBe(expectedInUtc);
    },
  );

  // Cross-timeZone coverage — ensure local day governs, not UTC day
  it.each`
    utcInstant                | timeZone              | expected | description
    ${"2024-02-03T23:00:00Z"} | ${"Europe/Berlin"}    | ${false} | ${"Sunday in Berlin (Saturday UTC + 1h)"}
    ${"2024-02-03T23:00:00Z"} | ${"Asia/Tokyo"}       | ${false} | ${"Sunday in Tokyo (Saturday UTC + 9h)"}
    ${"2024-02-03T23:00:00Z"} | ${"Pacific/Apia"}     | ${false} | ${"Sunday in Apia (Saturday UTC + 13h)"}
    ${"2024-02-03T23:00:00Z"} | ${"America/New_York"} | ${false} | ${"Saturday in New York (Saturday UTC - 5h)"}
    ${"2024-02-03T23:00:00Z"} | ${"Pacific/Niue"}     | ${false} | ${"Saturday in Niue (Saturday UTC - 11h)"}
    ${"2024-02-05T12:00:00Z"} | ${"America/New_York"} | ${true}  | ${"Monday in New York (Monday UTC - 5h)"}
    ${"2024-02-05T12:00:00Z"} | ${"Asia/Tokyo"}       | ${true}  | ${"Monday in Tokyo (Monday UTC + 9h)"}
  `(
    "returns $expected for $utcInstant in $timeZone ($description)",
    ({ utcInstant, timeZone, expected }) => {
      const zdt =
        Temporal.Instant.from(utcInstant).toZonedDateTimeISO(timeZone);
      expect(isZonedBusinessDay(zdt.toString())).toBe(expected);
    },
  );

  // Battle-test time zones — ensure every zone correctly identifies Mon–Fri as business days
  it.each`
    amount | expectedSuffix
    ${1}   | ${"T14:30:00"}
    ${2}   | ${"T14:30:00"}
  `("correctly identifies business days across all battle-test zones", () => {
    battleTestTimeZones.forEach((timeZone) => {
      // Monday in each zone
      const monday = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 2,
        day: 5, // Monday
        hour: 14,
        minute: 30,
        second: 0,
        timeZone,
      });
      expect(isZonedBusinessDay(monday.toString())).toBe(true);

      // Saturday in each zone
      const saturday = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 2,
        day: 3, // Saturday
        hour: 14,
        minute: 30,
        second: 0,
        timeZone,
      });
      expect(isZonedBusinessDay(saturday.toString())).toBe(false);

      // Sunday in each zone
      const sunday = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 2,
        day: 4, // Sunday
        hour: 14,
        minute: 30,
        second: 0,
        timeZone,
      });
      expect(isZonedBusinessDay(sunday.toString())).toBe(false);
    });
  });

  // DST boundary — same UTC instant can be different local days across DST transitions
  it.each`
    value                                            | expected | description
    ${"2024-03-10T06:30:00-05:00[America/New_York]"} | ${false} | ${"Sunday before spring-forward"}
    ${"2024-11-03T05:30:00-04:00[America/New_York]"} | ${false} | ${"Sunday during fall-back overlap"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(isZonedBusinessDay(value)).toBe(expected);
  });

  // Time component doesn't affect business-day determination
  it.each`
    date            | time          | expected
    ${"2024-02-05"} | ${"00:00:00"} | ${true}
    ${"2024-02-05"} | ${"12:00:00"} | ${true}
    ${"2024-02-05"} | ${"23:59:59"} | ${true}
    ${"2024-02-03"} | ${"00:00:00"} | ${false}
    ${"2024-02-03"} | ${"12:00:00"} | ${false}
    ${"2024-02-03"} | ${"23:59:59"} | ${false}
  `(
    "returns $expected regardless of time for $date $time",
    ({ date, time, expected }) => {
      const value = `${date}T${time}+00:00[UTC]`;
      expect(isZonedBusinessDay(value)).toBe(expected);
    },
  );
});
