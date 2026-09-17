import { unixEpochToInstant } from "../../internal/unixEpochValue";

/**
 * Return true when `timestamp` is a Unix milliseconds value every `unix/` function accepts.
 *
 * - A number must be a safe integer; a string must be an optionally negative run of ASCII digits
 *   (`"1700000000000"`), with no whitespace, `+`, decimal point, exponent or hex.
 * - The instant must lie in the Temporal range: ±8.64e15 milliseconds (10^8 days) from the epoch.
 *
 * @param timestamp candidate value of any type
 * @returns boolean indicating whether the timestamp is a valid Unix milliseconds value
 *
 * @example isValidUnixMilliseconds(1700000000000) // true
 * @example isValidUnixMilliseconds("-86400000") // true (1969-12-31)
 * @example isValidUnixMilliseconds(1.5) // false
 * @example isValidUnixMilliseconds("1700000000000.0") // false (not a digit string)
 * @example isValidUnixMilliseconds(8640000000000001) // false (past the last Temporal instant)
 */
export function isValidUnixMilliseconds(timestamp: unknown): boolean {
  return unixEpochToInstant(timestamp, "milliseconds") !== null;
}
