import { getSystemTimeZone } from "../zoned/get";
import { isValidTimeZone } from "../zoned/validate";

/**
 * Resolve an optional Unix diff timeZone to its default (system timeZone) when unset.
 *
 * @param timeZone optional IANA timeZone
 * @returns the resolved timeZone, or "" if invalid
 * @example resolveUnixTimeZone(undefined) // system timeZone, e.g. "America/New_York"
 * @example resolveUnixTimeZone("Europe/Helsinki") // "Europe/Helsinki"
 * @example resolveUnixTimeZone("not-a-timezone") // ""
 */
export function resolveUnixTimeZone(timeZone?: string): string {
  const resolved = timeZone ?? getSystemTimeZone();

  return resolved && isValidTimeZone(resolved) ? resolved : "";
}

/**
 * Validate that both Unix epoch values are safe integers.
 *
 * - Past ±(2^53 − 1) consecutive integers are no longer distinct doubles (`2 ** 53 + 1 === 2 ** 53`),
 *   so such values are rejected. Every Temporal instant (±8.64e15 ms) is inside that range.
 *
 * @param value1 first Unix timestamp
 * @param value2 second Unix timestamp
 * @returns true if both values are safe integers
 * @example isValidUnixEpochPair(1704067200000, 1704153600000) // true
 * @example isValidUnixEpochPair(NaN, 1704153600000) // false
 * @example isValidUnixEpochPair(2 ** 53, 0) // false
 */
export function isValidUnixEpochPair(value1: number, value2: number): boolean {
  return Number.isSafeInteger(value1) && Number.isSafeInteger(value2);
}
