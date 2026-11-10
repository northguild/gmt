import { parseFixUtcTimestamp } from "../parse/parseFixUtcTimestamp";

/**
 * Return true when `value` is a FIX `UTCTimestamp` that states a real UTC second.
 *
 * - True exactly when `parseFixUtcTimestamp` returns a value for the same argument: the
 *   validator calls the parser, so the two cannot disagree.
 * - Checks the calendar and the leap-second table as well as the shape: 30 February, hour 24 and
 *   a `60` on a day with no inserted leap second are false. For the shape of an ISO second 60
 *   alone, `hasSecond60`; for an ISO leap second, `isLeapSecond`.
 * - A fraction of 3, 6, 9 or 12 digits, or none; any other width is false (FIX Latest: other
 *   widths are "with bilateral agreement", which a value does not carry).
 * - A value that is not a string, a `String` object included, returns false. A true result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as a FIX `UTCTimestamp` (e.g. "20240615-14:30:00.123")
 * @returns boolean indicating validity
 *
 * @example isValidFixUtcTimestamp("20240615-14:30:00.123") // true
 * @example isValidFixUtcTimestamp("20161231-23:59:60") // true (an inserted leap second)
 * @example isValidFixUtcTimestamp("20171231-23:59:60") // false (no insertion that day)
 * @example isValidFixUtcTimestamp("20240615-14:30:00.12") // false (2 digits: FIX names no precision)
 * @example isValidFixUtcTimestamp("2024-06-15T14:30:00Z") // false (ISO 8601, not FIX)
 * @example isValidFixUtcTimestamp(null) // false
 */
export function isValidFixUtcTimestamp(value: string): boolean;
export function isValidFixUtcTimestamp(
  value: {} | null | undefined | void,
): boolean;
export function isValidFixUtcTimestamp(value: unknown): value is string;
export function isValidFixUtcTimestamp(value: unknown): boolean {
  return typeof value === "string" && parseFixUtcTimestamp(value) !== null;
}
