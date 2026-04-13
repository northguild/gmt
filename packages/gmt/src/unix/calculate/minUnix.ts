import { isValidAmount } from "../../internal";

/**
 * Return the earliest (minimum) of the given Unix timestamp values.
 *
 * - Returns null if the array is empty.
 * - Accepts Unix timestamps in seconds or milliseconds.
 *
 * @param unixValues Array of Unix timestamps (e.g. 1699531200)
 * @example minUnix([1706659200000, 1704067200000, 1700000000000]) // 1700000000000
 * @example minUnix([1704067200, 1700000000], { epochUnit: "seconds" }) // 1700000000
 * @example minUnix([]) // null
 * @returns The earliest Unix timestamp, or null on invalid input
 */
export function minUnix(unixValues: number[]): number | null {
  if (!unixValues.length) return null;

  const valid = unixValues.filter(isValidAmount);
  if (!valid.length) return null;

  return Math.min(...valid);
}
