import { isValidAmount } from "../../internal";

/**
 * Sort an array of Unix timestamp values in ascending or descending order.
 *
 * - Filters invalid values before sorting.
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
 */
export function sortUnix(
  unixValues: number[],
  order: "asc" | "desc" = "asc",
): number[] {
  if (!unixValues.length) return [];

  const valid = unixValues.filter(isValidAmount);
  if (!valid.length) return [];

  const sorted = valid.sort((a, b) => a - b);

  if (order === "desc") {
    return sorted.reverse();
  }

  return sorted;
}
