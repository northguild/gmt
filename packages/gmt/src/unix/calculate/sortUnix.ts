import { isUnixEpochInInstantRange } from "../../internal/unixEpochValue";

/**
 * Sort an array of Unix timestamp values in ascending or descending order.
 *
 * - Drops values that are not unix epochs before sorting: non-numbers, non-integers, and values
 *   outside the Temporal instant range (±8.64e15, which contains every seconds and milliseconds epoch).
 * - Supports "asc" (earliest first) or "desc" (latest first).
 * - Returns [] if array is empty or has no valid values.
 *
 * @param unixValues Array of Unix timestamps (e.g. 1699531200)
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of Unix timestamps
 *
 * @example sortUnix([1706659200000, 1704067200000, 1700000000000]) // [1700000000000, 1704067200000, 1706659200000]
 * @example sortUnix([1704067200, 1700000000], "desc") // [1704067200, 1700000000]
 * @example sortUnix([]) // []
 * @example sortUnix([3, 1.5, 1]) // [1, 3] (1.5 is not an integer epoch)
 */
export function sortUnix(
  unixValues: number[],
  order: "asc" | "desc" = "asc",
): number[] {
  if (!Array.isArray(unixValues) || !unixValues.length) return [];

  const valid = unixValues.filter(isUnixEpochInInstantRange);
  if (!valid.length) return [];

  const sorted = valid.sort((a, b) => a - b);

  if (order === "desc") {
    return sorted.reverse();
  }

  return sorted;
}
