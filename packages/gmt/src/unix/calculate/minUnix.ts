import { isValidAmount } from "../../internal";

/**
 * Return the earliest (minimum) of the given Unix timestamp values.
 *
 * - Filters invalid values before finding minimum.
 * - Returns null if array is empty or has no valid values.
 *
 * @param unixValues Array of Unix timestamps (e.g. 1699531200)
 * @returns The earliest Unix timestamp, or null on invalid input
 *
 * @example minUnix([1706659200000, 1704067200000, 1700000000000]) // 1700000000000
 * @example minUnix([]) // null
 */
export function minUnix(unixValues: number[]): number | null {
  if (!unixValues.length) return null;

  const valid = unixValues.filter(isValidAmount);
  if (!valid.length) return null;

  return Math.min(...valid);
}
