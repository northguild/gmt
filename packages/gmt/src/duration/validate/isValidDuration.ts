import { isDurationString } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from to validate.
 * - Accepts date, time, and combined durations, including negative and fractional units.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO 8601 duration
 * @returns true if value is a valid ISO 8601 duration string, or false on invalid input
 *
 * @example isValidDuration("P1DT2H30M") // true
 * @example isValidDuration("PT0S") // true
 * @example isValidDuration("-P1D") // true
 * @example isValidDuration("not a duration") // false
 * @example isValidDuration("") // false
 * @example isValidDuration(null) // false
 */
export function isValidDuration(value: string): boolean;
export function isValidDuration(value: {} | null | undefined | void): boolean;
export function isValidDuration(value: unknown): value is string;
export function isValidDuration(value: unknown): boolean {
  return isDurationString(value);
}
