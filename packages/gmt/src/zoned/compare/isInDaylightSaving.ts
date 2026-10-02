import { isValidZonedDateTime } from "../validate";
import { isInDaylightTime, zonedDateTimeFrom } from "../../internal";

/**
 * Check whether a zoned value's instant falls within daylight saving time.
 *
 * - The rule is GMT's own definition, not the tz database's daylight flag. No JavaScript API
 *   exposes that flag, and it cannot be worked out from offsets.
 * - The rule: daylight time runs from a forward change of the zone's clocks to the backward
 *   change that undoes it. A backward change undoes the most recent forward change of the same
 *   size not yet undone, if it comes less than 365 days after it. The instant is in daylight
 *   time when it is at or after such a forward change and before its backward change.
 * - Read from the zone's offset changes in the runtime's time zone data
 *   (`getTimeZoneTransition`); GMT holds no zone data. The answer changes only at a clock
 *   change, and the answer for a past instant can change when the runtime's data learns that a
 *   zone stopped changing its clocks.
 * - A forward change never undone, or undone 365 days or more later, is a change of standard
 *   time: `Europe/Istanbul` is on standard time from its last advance in March 2016.
 * - The higher of two alternating offsets is the daylight one, as in the tz database's rearguard
 *   form. Its main form reverses `Europe/Dublin` (winter is its daylight time, a negative save)
 *   and `Africa/Casablanca` (the Ramadan weeks are); here Dublin's summer and Casablanca's
 *   months at `+01:00` are daylight time.
 * - Read as standard time, because the offsets do not show otherwise:
 *   - the last summer before a zone kept its daylight offset for good (the tz database dates
 *     Istanbul's switch 2016-09-07, with no clock change);
 *   - a daylight period held 365 days or longer (`America/Santiago` 2014 to 2016);
 *   - a daylight period that began, ended or was interrupted by a move of standard time, so the
 *     clocks went back by another amount or not at all (`America/Kentucky/Monticello` 2000), or
 *     the offset changed part-way through and the rest, or all, of the period is not paired
 *     (`Asia/Tomsk` 2002, `Asia/Jerusalem` 1948);
 *   - a daylight period whose end is past the last instant Temporal can represent.
 * - Read as daylight time: a move of standard time reversed by the same amount less than 365
 *   days later (`America/Metlakatla` 2018 to 2019).
 * - The other DST functions answer other questions: `hasDaylightSaving(timeZone, { at })` whether
 *   a zone observes DST at an instant, `getDstTransitions(timeZone, year)` where its offset
 *   changes fall, and `classifyLocal` whether a wall time is ambiguous. See
 *   docs/dst-disambiguation.md.
 * - Returns false for invalid input, and for a zone with a fixed offset.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns true if the instant is in daylight saving time, false otherwise or on invalid input
 *
 * @example isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]") // true
 * @example isInDaylightSaving("2024-01-15T12:00:00-05:00[America/New_York]") // false
 * @example isInDaylightSaving("2024-01-15T12:00:00+11:00[Australia/Sydney]") // true (southern-hemisphere summer)
 * @example isInDaylightSaving("2024-07-15T12:00:00+09:00[Asia/Tokyo]") // false (Asia/Tokyo has no DST)
 * @example isInDaylightSaving("2015-07-01T12:00:00+03:00[Europe/Istanbul]") // true (undone 2015-11-08)
 * @example isInDaylightSaving("2016-07-01T12:00:00+03:00[Europe/Istanbul]") // false (the March 2016 advance was never undone)
 * @example isInDaylightSaving("2016-12-01T12:00:00+03:00[Europe/Istanbul]") // false (permanent +03:00)
 * @example isInDaylightSaving("2019-07-15T12:00:00+01:00[Europe/Dublin]") // true
 * @example isInDaylightSaving("2019-12-01T12:00:00+01:00[Africa/Casablanca]") // true (put back 2020-04-19)
 * @example isInDaylightSaving("2019-07-15T12:00:00+00:00[UTC]") // false
 * @example isInDaylightSaving("invalid") // false
 */
export function isInDaylightSaving(value: string): boolean {
  if (!isValidZonedDateTime(value)) {
    return false;
  }

  try {
    return isInDaylightTime(zonedDateTimeFrom(value));
  } catch {
    return false;
  }
}
