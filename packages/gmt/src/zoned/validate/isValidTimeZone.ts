import { Temporal } from "@js-temporal/polyfill";
import { timeZoneLike } from "../../regex";

/**
 * Validate whether a string is a valid IANA timeZone identifier.
 *
 * - Uses the Temporal polyfill to construct a ZonedDateTime and a regex
 *   sanity-check on the timeZone string.
 * - Returns `true` when the timeZone appears valid, otherwise `false`.
 *
 * @param timeZone timeZone identifier to validate
 * @example isValidTimeZone("America/New_York") // true
 * @example isValidTimeZone("Europe/London") // true
 * @example isValidTimeZone("Invalid/Timezone") // false
 * @returns boolean indicating validity
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    Temporal.ZonedDateTime.from({
      year: 2020,
      month: 2,
      day: 28,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone,
    });
    return timeZoneLike.test(timeZone) && true;
  } catch {
    return false;
  }
}
