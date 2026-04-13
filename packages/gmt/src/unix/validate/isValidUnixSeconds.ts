/**
 * Return true when `timestamp` is a valid Unix seconds value.
 * - Must be a non-negative integer.
 *
 * @param timestamp number candidate
 * @example isValidUnixSeconds(1700000000) => true
 * @example isValidUnixSeconds(-1) => false
 * @returns boolean indicating whether the timestamp is a valid Unix seconds value
 */
export function isValidUnixSeconds(timestamp: unknown): boolean {
  if (typeof timestamp === "number") {
    return Number.isInteger(timestamp) && timestamp >= 0;
  }
  return false;
}
