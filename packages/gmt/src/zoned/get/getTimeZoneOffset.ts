import { instantFrom } from "../../internal/instantNanoseconds";
import { hasInstantShape } from "../../internal/isoStringBody";
import { instantLeapSecond } from "../../regex";
import { frameOffset, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return a time zone's UTC offset at a given instant.
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
 * - The instant is exactly ISO 8601 extended `<date>T<time>` then `Z` or `±HH:MM[:SS[.fraction]]`,
 *   over the whole string: basic format, a `t` or space separator, a lower-case `z`, an
 *   hour-only offset and an annotation of any kind (`[Asia/Tokyo]`, `[u-ca=iso8601]`, `[foo=bar]`)
 *   return "".
 * - The result is `±HH:MM`, or `±HH:MM:SS` where the zone was not on a whole minute
 *   (`Africa/Monrovia` stood at `-00:44:30` until 1972). It goes straight into the time zone
 *   position of any function whose result has no zone in it, and of this one: a UTC offset is its
 *   own answer at every instant, written without seconds when they are zero.
 *
 * @param timeZone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or a
 *   stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @param instant ISO 8601 instant string (e.g. "2024-07-15T12:00:00Z")
 * @returns offset string (e.g. "+10:00"), or "" on invalid input
 *
 * @example getTimeZoneOffset("Australia/Sydney", "2024-07-15T12:00:00Z") // "+10:00"
 * @example getTimeZoneOffset("Australia/Sydney", "2024-01-15T12:00:00Z") // "+11:00"
 * @example getTimeZoneOffset("Asia/Kathmandu", "2024-01-15T12:00:00Z") // "+05:45"
 * @example getTimeZoneOffset("Africa/Monrovia", "1970-01-01T12:00:00Z") // "-00:44:30" (an offset with seconds)
 * @example getTimeZoneOffset("-00:44:30", "1970-01-01T12:00:00Z") // "-00:44:30" (its own result, read back)
 * @example getTimeZoneOffset("+05:30:00", "1970-01-01T12:00:00Z") // "+05:30"
 * @example getTimeZoneOffset("Invalid/Zone", "2024-07-15T12:00:00Z") // ""
 * @example getTimeZoneOffset("Africa/Johannesburg", "not an instant") // ""
 * @example getTimeZoneOffset("Africa/Johannesburg", "2024-07-15T16:00:00z") // "" (lower-case z)
 * @example getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z") // "" (leap second)
 * @example getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z".replace(":60", ":59")) // "+00:00" (the clamped instant)
 */
export function getTimeZoneOffset(timeZone: string, instant: string): string {
  if (typeof instant !== "string") {
    return "";
  }

  const frame = zoneFrame(timeZone);

  if (
    frame === null ||
    instantLeapSecond.test(instant) ||
    !hasInstantShape(instant)
  ) {
    return "";
  }

  try {
    const at = instantFrom(instant);

    // A stored offset with seconds is its own answer at every valid instant.
    return frame.shiftNanoseconds !== 0n
      ? frameOffset(frame)
      : at.toZonedDateTimeISO(frame.timeZone).offset;
  } catch {
    return "";
  }
}
