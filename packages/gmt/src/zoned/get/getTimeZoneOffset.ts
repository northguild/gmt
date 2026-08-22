import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return an IANA timeZone's UTC offset at a given instant.
 *
 * - Unlike `getZonedOffset`, this doesn't need an existing zoned value in
 *   hand — pass any timeZone identifier and an instant to look up, which is
 *   why (like `getDstTransitions`) it lives in `get/` despite taking two
 *   arguments: neither is a date *value* being described, both are
 *   coordinates for a zone-level lookup.
 * - Returns "" for an invalid timeZone or instant.
 *
 * @param timeZone IANA timeZone identifier
 * @param instant ISO 8601 instant string (e.g. "2024-07-15T12:00:00Z")
 * @returns offset string (e.g. "-04:00"), or "" on invalid input
 *
 * @example getTimeZoneOffset("America/New_York", "2024-07-15T12:00:00Z") // "-04:00"
 * @example getTimeZoneOffset("America/New_York", "2024-01-15T12:00:00Z") // "-05:00"
 * @example getTimeZoneOffset("Asia/Kathmandu", "2024-01-15T12:00:00Z") // "+05:45"
 * @example getTimeZoneOffset("Invalid/Zone", "2024-07-15T12:00:00Z") // ""
 * @example getTimeZoneOffset("America/New_York", "not an instant") // ""
 */
export function getTimeZoneOffset(timeZone: string, instant: string): string {
  if (!isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).offset;
  } catch {
    return "";
  }
}
