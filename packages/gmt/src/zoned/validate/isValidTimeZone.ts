import { timeZoneLike } from "../../regex";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Validate whether a string is a valid time zone identifier: an IANA name or a UTC offset.
 *
 * - Uses Temporal.ZonedDateTime.from to test timezone validity.
 * - Uses the `timeZoneLike` regex to check the identifier's shape: Temporal's
 *   `TimeZoneIdentifier` grammar (§14.6.2).
 * - Accepts every IANA Zone and Link name the runtime accepts, including single-component names
 *   (`UTC`, `Japan`, `Zulu`, `EST5EDT`, `GMT+0`), in any letter case (ECMA-402 matches
 *   identifiers ASCII-case-insensitively, so `utc` is as valid as `america/new_york`).
 * - Accepts an offset identifier (`UTCOffset[~SubMinutePrecision]`): `"+05:00"`, `"+0530"`,
 *   `"-08"`, hour `00`–`23`, no seconds. Temporal and `Intl.DateTimeFormat` accept the same ones.
 * - Returns false for invalid timezone formats.
 * - Compatibility: earlier releases required a `/` in every name except `UTC` and `GMT`. To keep
 *   that narrower rule, also require `timeZone.includes("/")` or `"UTC"`/`"GMT"`.
 *
 * @param timeZone timeZone identifier to validate
 * @returns boolean indicating validity
 *
 * @example isValidTimeZone("America/New_York") // true
 * @example isValidTimeZone("Europe/London") // true
 * @example isValidTimeZone("Invalid/Timezone") // false
 * @example isValidTimeZone("Japan") // true (IANA link to Asia/Tokyo)
 * @example isValidTimeZone("utc") // true (case-insensitive)
 * @example isValidTimeZone("+05:00") // true (an offset identifier)
 * @example isValidTimeZone("+05:00:00") // false (no seconds in an offset identifier)
 * @example "Japan".includes("/") // false (the earlier slash-only rule)
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
