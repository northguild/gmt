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
 * Validate that both Unix epoch values are finite integers.
 *
 * @param value1 first Unix timestamp
 * @param value2 second Unix timestamp
 * @returns true if both values are finite integers
 * @example isValidUnixEpochPair(1704067200000, 1704153600000) // true
 * @example isValidUnixEpochPair(NaN, 1704153600000) // false
 */
export function isValidUnixEpochPair(value1: number, value2: number): boolean {
  return (
    Number.isFinite(value1) &&
    Number.isInteger(value1) &&
    Number.isFinite(value2) &&
    Number.isInteger(value2)
  );
}
