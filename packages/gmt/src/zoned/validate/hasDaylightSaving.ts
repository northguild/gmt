import { Temporal } from "@js-temporal/polyfill";

/**
 * Check whether an IANA timeZone identifier observes daylight saving time.
 *
 * - Compares UTC offsets at two dates six months apart (January and July).
 * - A zone is considered to have DST if its offset differs between the two dates.
 * - Returns false for invalid or unresolvable timeZone identifiers.
 *
 * @param timeZone timeZone identifier to check
 * @returns boolean indicating whether the timeZone observes DST
 *
 * @example hasDaylightSaving("America/New_York") // true
 * @example hasDaylightSaving("Europe/Berlin")     // true
 * @example hasDaylightSaving("Asia/Tokyo")        // false
 * @example hasDaylightSaving("UTC")               // false
 * @example hasDaylightSaving("Invalid/Zone")      // false
 */
export function hasDaylightSaving(timeZone: string): boolean {
  try {
    const zdtJanuary = Temporal.ZonedDateTime.from({
      year: 2024,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
      second: 0,
      timeZone,
    });

    const zdtJuly = Temporal.ZonedDateTime.from({
      year: 2024,
      month: 7,
      day: 15,
      hour: 12,
      minute: 0,
      second: 0,
      timeZone,
    });

    return zdtJanuary.offsetNanoseconds !== zdtJuly.offsetNanoseconds;
  } catch {
    return false;
  }
}
