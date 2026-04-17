import { isValidAmount } from "../../internal";

/**
 * Return the latest (maximum) of the given Unix timestamp values.
 *
 * - Filters invalid values before finding maximum.
 * - Returns null if array is empty or has no valid values.
 *
 * @param unixValues Array of Unix timestamps (e.g. 1699531200)
 * @returns The latest Unix timestamp, or null on invalid input
 *
 * @example maxUnix([1706659200000, 1704067200000, 1700000000000]) // 1706659200000
 * @example maxUnix([]) // null
 */
export function maxUnix(unixValues: number[]): number | null {
  if (!unixValues.length) return null;

  const valid = unixValues.filter(isValidAmount);
  if (!valid.length) return null;

  return Math.max(...valid);
}
