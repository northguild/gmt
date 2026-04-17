/**
 * Return true when `timestamp` is a valid Unix seconds value.
 *
 * - Must be an integer (positive or negative, for dates before/after 1970).
 * - Returns false for non-numbers or non-integers.
 *
 * @param timestamp number candidate
 * @returns boolean indicating whether the timestamp is a valid Unix seconds value
 *
 * @example isValidUnixSeconds(1700000000) // true
 * @example isValidUnixSeconds(-86400) // true (1969-12-31)
 * @example isValidUnixSeconds(1.5) // false
 */
export function isValidUnixSeconds(timestamp: unknown): boolean {
  if (typeof timestamp === "number") {
    return Number.isInteger(timestamp);
  }
  return false;
}
