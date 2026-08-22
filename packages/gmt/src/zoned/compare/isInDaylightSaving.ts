import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Check whether a zoned value's instant falls within daylight saving time.
 *
 * - The third DST-related function in the roadmap, and distinct from the
 *   other two — see docs/dst-disambiguation.md for the full four-way split:
 *   `hasDaylightSaving(timeZone)` asks whether a zone observes DST *at all*
 *   (zone-level, no instant); `listDstTransitions(timeZone, year)` asks
 *   *where* a zone's transitions fall (enumerates instants);
 *   `isInDaylightSaving(value)` asks whether *this particular instant* is
 *   currently in DST. `disambiguation`/`offset` (Group C) are a fourth,
 *   orthogonal concern: what to do when construction lands on an ambiguous
 *   or nonexistent instant.
 * - Returns false for invalid input, and false for a zone that doesn't
 *   observe DST at all.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns true if the instant is in daylight saving time, false otherwise or on invalid input
 *
 * @example isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]") // true
 * @example isInDaylightSaving("2024-01-15T12:00:00-05:00[America/New_York]") // false
 * @example isInDaylightSaving("2024-01-15T12:00:00+11:00[Australia/Sydney]") // true (southern-hemisphere summer)
 * @example isInDaylightSaving("2024-07-15T12:00:00+09:00[Asia/Tokyo]") // false (Asia/Tokyo has no DST)
 * @example isInDaylightSaving("invalid") // false
 */
export function isInDaylightSaving(value: string): boolean {
  if (!isValidZonedDateTime(value)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const { timeZoneId: timeZone, year } = zonedDateTime;

    // Sample the zone's offset 6 months apart, within the same calendar year
    // as `value` (a zone's DST rules can change between years). DST always
    // shifts a zone's clocks forward relative to its own standard time, in
    // every hemisphere, so whichever of these two offsets is smaller is
    // "standard" — regardless of whether the zone's DST season falls in the
    // Jan or Jul half of the year. This mirrors `hasDaylightSaving`'s
    // Jan/Jul sampling, but anchored to `value`'s own year rather than a
    // fixed reference year, and doesn't attempt to detect a zone whose
    // standard offset itself changed permanently mid-year (rare, and H3
    // shares the same limitation).
    const januaryOffsetNanoseconds = Temporal.ZonedDateTime.from({
      year,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
      second: 0,
      timeZone,
    }).offsetNanoseconds;

    const julyOffsetNanoseconds = Temporal.ZonedDateTime.from({
      year,
      month: 7,
      day: 15,
      hour: 12,
      minute: 0,
      second: 0,
      timeZone,
    }).offsetNanoseconds;

    const standardOffsetNanoseconds = Math.min(
      januaryOffsetNanoseconds,
      julyOffsetNanoseconds,
    );

    return zonedDateTime.offsetNanoseconds > standardOffsetNanoseconds;
  } catch {
    return false;
  }
}
