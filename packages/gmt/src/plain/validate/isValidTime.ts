import { isTimeString } from "../../internal/inputChecks";

/**
 * Return true when `value` is a valid ISO PlainTime string.
 *
 * - The part before the first annotation must match `plainTime`.
 * - Reads RFC 9557 annotations as `Temporal.PlainTime.from` does: elective ones (`[foo=bar]`), a
 *   time zone annotation and a calendar annotation are ignored (a time has no calendar), and an
 *   unknown critical one (`[!foo=bar]`) is rejected.
 * - Rejects leap seconds (e.g., "23:59:60").
 * - Rejects invalid times (e.g., "24:00:00", "23:60:00").
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO PlainTime
 * @returns boolean indicating validity
 *
 * @example isValidTime("12:34:56") // true
 * @example isValidTime("24:00:00") // false (invalid hour)
 * @example isValidTime("12:34:56[u-ca=hebrew]") // true (calendar annotation ignored)
 * @example isValidTime("12:34:56[!foo=bar]") // false (unknown critical annotation)
 * @example isValidTime("23:60:00") // false (invalid minute)
 * @example isValidTime("23:59:60") // false (leap second)
 * @example isValidTime(null) // false
 */
export function isValidTime(value: string): boolean;
export function isValidTime(value: {} | null | undefined | void): boolean;
export function isValidTime(value: unknown): value is string;
export function isValidTime(value: unknown): boolean {
  return typeof value === "string" && isTimeString(value);
}
