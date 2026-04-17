/**
 * Return true when `timestamp` is a valid Unix milliseconds value.
 *
 * - Must be an integer (positive or negative, for dates before/after 1970).
 * - Returns false for non-numbers or non-integers.
 *
 * @param timestamp number candidate
 * @returns boolean indicating whether the timestamp is a valid Unix milliseconds value
 *
 * @example isValidUnixMilliseconds(1700000000000) // true
 * @example isValidUnixMilliseconds(-86400000) // true (1969-12-31)
 * @example isValidUnixMilliseconds(1.5) // false
 */
export function isValidUnixMilliseconds(timestamp: unknown): boolean {
  if (typeof timestamp === "number") {
    return Number.isInteger(timestamp);
  }
  return false;
}
