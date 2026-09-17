import { parseUnixEpochsInInstantRange } from "../../internal/unixEpochValue";

/**
 * Return the latest (maximum) of the given Unix timestamp values.
 *
 * - Drops values that are not unix epochs first: anything that is not a safe integer or a string of optionally negative ASCII digits, and values outside
 *   the Temporal instant range (±8.64e15, which contains every seconds and milliseconds epoch).
 * - Returns null if array is empty or has no valid values.
 *
 * @param unixValues Array of Unix epochs as numbers or digit strings (e.g. 1699531200 or "1699531200"); digit strings are returned as numbers
 * @returns The latest Unix timestamp, or null on invalid input
 *
 * @example maxUnix([1706659200000, 1704067200000, 1700000000000]) // 1706659200000
 * @example maxUnix([]) // null
 * @example maxUnix([1, 1e20]) // 1 (1e20 is outside the instant range)
 * @example maxUnix(["-86400", "-1"]) // -1
 */
export function maxUnix(unixValues: Array<number | string>): number | null {
  const valid = parseUnixEpochsInInstantRange(unixValues);
  if (!valid.length) return null;

  // Pairwise, not `Math.max(...valid)`: spreading a long list overflows the call stack.
  return valid.reduce((a, b) => Math.max(a, b));
}
