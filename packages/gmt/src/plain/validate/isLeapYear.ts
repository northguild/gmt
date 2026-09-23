import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "./isValidDate";

/**
 * Return true when the given PlainDate falls in a leap year.
 *
 * - A leap year is divisible by 4, except for century years which must be divisible by 400.
 * - Returns false for invalid input strings, including every shape `isValidDate` rejects: a
 *   date-time, zoned, basic-format or leap-second string, or a non-ISO calendar annotation. The
 *   annotations Temporal ignores are accepted (`"2024-06-15[u-ca=iso8601]"` → true).
 * - Compatibility: earlier releases read those shapes loosely (`"2024-03-15T10:00"` → `true`).
 *   Pass the date part alone, or use `Temporal.PlainDate.from(value).inLeapYear`.
 *
 * @param value ISO PlainDate string
 * @returns boolean indicating whether the date is in a leap year
 *
 * @example isLeapYear("2024-03-15") // true
 * @example isLeapYear("2023-03-15") // false
 * @example isLeapYear("invalid") // false
 * @example isLeapYear("2024-03-15T10:00") // false (a date-time, not a PlainDate)
 * @example isLeapYear("2024-03-15T10:00".slice(0, 10)) // true (the date part)
 */
export function isLeapYear(value: string): boolean {
  if (!isValidDate(value)) return false;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.inLeapYear;
  } catch {
    return false;
  }
}
