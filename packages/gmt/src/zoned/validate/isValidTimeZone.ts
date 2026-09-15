import { timeZoneLike } from "../../regex";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Validate whether a string is a valid IANA timeZone identifier.
 *
 * - Uses Temporal.ZonedDateTime.from to test timezone validity.
 * - Uses regex to check format.
 * - Returns false for invalid timezone formats.
 *
 * @param timeZone timeZone identifier to validate
 * @returns boolean indicating validity
 *
 * @example isValidTimeZone("America/New_York") // true
 * @example isValidTimeZone("Europe/London") // true
 * @example isValidTimeZone("Invalid/Timezone") // false
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    zonedDateTimeFrom({
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
