import { unixEpochToInstant } from "../../internal/unixEpochValue";

/**
 * Return true when `timestamp` is a Unix seconds value every `unix/` function accepts.
 *
 * - A number must be a safe integer; a string must be an optionally negative run of ASCII digits
 *   (`"1700000000"`, `"-86400"`), with no whitespace, `+`, decimal point, exponent or hex.
 * - The instant must lie in the Temporal range: ±8.64e12 seconds (10^8 days) from the epoch.
 *
 * @param timestamp candidate value of any type
 * @returns boolean indicating whether the timestamp is a valid Unix seconds value
 *
 * @example isValidUnixSeconds(1700000000) // true
 * @example isValidUnixSeconds("-86400") // true (1969-12-31)
 * @example isValidUnixSeconds(1.5) // false
 * @example isValidUnixSeconds("1e9") // false (not a digit string)
 * @example isValidUnixSeconds(8640000000001) // false (past the last Temporal instant)
 */
export function isValidUnixSeconds(timestamp: unknown): boolean {
  return unixEpochToInstant(timestamp, "seconds") !== null;
}
