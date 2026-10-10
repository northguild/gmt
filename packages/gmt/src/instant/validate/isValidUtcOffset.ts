import { utcOffset } from "../../regex";

/**
 * Return true when `value` is a UTC offset in the form the offset-instant pair stores: ISO 8601
 * extended `±HH:MM`, optionally `±HH:MM:SS`.
 *
 * - This is the offset `toOffsetInstant` returns and `fromOffsetInstant` takes, and the one
 *   `getTimeZoneOffset` and `getZonedOffset` return.
 * - **The `utcOffset` pattern is the whole check.** Every string it matches is in range (hour
 *   `00`–`23`, minute and second `00`–`59`), so this validator is the pattern test plus the
 *   answer false for a non-string.
 * - `Z` is false: it is a designator meaning "this string is already UTC", and for an event at
 *   UTC the pair's offset is `+00:00`.
 * - Seconds are allowed because some zones did not run on a whole minute: `Africa/Monrovia` was
 *   `-00:44:30` until 1972. A fraction of a second is false.
 * - Basic format (`-0400`) and an hour alone (`-04`) are false.
 * - `-00:00` is true, and the functions that take an offset read it as `+00:00`.
 * - A function whose result has no zone in it takes this offset in its time zone position too. A
 *   function that returns a zoned string, or formats with `Intl`, takes a time zone identifier
 *   only: check that with `isValidTimeZone`, which accepts `+0530` and `-08` and rejects an offset
 *   with seconds.
 *
 * @param value candidate UTC offset string
 * @returns boolean indicating validity
 *
 * @example isValidUtcOffset("-04:00") // true
 * @example isValidUtcOffset("+05:45") // true
 * @example isValidUtcOffset("-00:44:30") // true (Africa/Monrovia before 1972)
 * @example isValidUtcOffset("Z") // false (a designator, not an offset)
 * @example isValidUtcOffset("-0400") // false (basic format)
 * @example isValidUtcOffset("+24:00") // false (out of range)
 * @example isValidUtcOffset("America/New_York") // false (a zone, not an offset)
 */
export function isValidUtcOffset(value: string): boolean {
  return typeof value === "string" && utcOffset.test(value);
}
