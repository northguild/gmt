import { isValidAmount } from "../../internal";

/**
 * Sort an array of Unix timestamp values in ascending or descending order.
 *
 * - Returns empty array if input is empty.
 * - Accepts Unix timestamps in seconds or milliseconds.
 *
 * @param unixValues Array of Unix timestamps (e.g. 1699531200)
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of Unix timestamps
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
