import { Temporal } from "@js-temporal/polyfill";
import { hasInstantShape } from "../../internal/isoStringBody";
import { instantLeapSecond } from "../../regex";
import { isValidTimeZone } from "../validate";

/**
 * Return an IANA timeZone's UTC offset at a given instant.
 *
 * - Unlike `getZonedOffset`, this doesn't need an existing zoned value in
 *   hand — pass any timeZone identifier and an instant to look up, which is
 *   why (like `getDstTransitions`) it lives in `get/` despite taking two
 *   arguments: neither is a date *value* being described, both are
 *   coordinates for a zone-level lookup.
 * - Returns "" for an invalid timeZone or instant, including a leap second in any spelling
 *   (`23:59:60`, `t`/space separator, basic `235960`), which Temporal would read as `:59`.
 *   Compatibility: to look up the offset at the clamped `:59` instant as earlier releases did,
 *   pass that instant (`"2016-12-31T23:59:59Z"`), or call
 *   `Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).offset` directly.
 * - The instant is ISO 8601 extended format before any annotation (`<date>T<time>`, then `Z` or
 *   `±HH:MM[:SS[.fraction]]`): basic format, a `t` or space separator, a lower-case `z` and an
 *   hour-only offset return "".
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
 * @example getTimeZoneOffset("America/New_York", "2024-07-15T16:00:00z") // "" (lower-case z)
 * @example getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z") // "" (leap second)
 * @example getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z".replace(":60", ":59")) // "+00:00" (the clamped instant)
 */
export function getTimeZoneOffset(timeZone: string, instant: string): string {
  if (
    !isValidTimeZone(timeZone) ||
    instantLeapSecond.test(instant) ||
    !hasInstantShape(instant)
  ) {
    return "";
  }

  try {
    return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).offset;
  } catch {
    return "";
  }
}
