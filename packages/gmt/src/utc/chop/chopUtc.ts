import { utcInstantOf } from "../../internal/utcInstant";

/**
 * Return the UTC datetime string with a trailing Z removed if present.
 *
 * - Removes the trailing "Z"; a lower-case "z" is not a GMT UTC string (`isValidUtc`), so it returns "".
 * - Returns "" for a string with any annotation (`[foo=bar]`, `[u-ca=iso8601]`, `[Europe/Paris]`): a UTC string is `…Z` and nothing after.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (ISO 8601)
 * @returns UTC datetime string without trailing Z or "" on invalid input
 *
 * @example chopUtc("2024-03-10T12:00:00Z") // "2024-03-10T12:00:00"
 * @example chopUtc("2024-03-10T12:00:00") // "" (no Z: not a UTC instant)
 * @example chopUtc("2024-03-10T12:00:00z") // "" (lower-case z)
 * @example chopUtc("invalid") // ""
 * @example chopUtc("2024-03-10T12:00:00Z[foo=bar]") // "" (annotation)
 */
export function chopUtc(value: string): string {
  if (utcInstantOf(value) === null) {
    return "";
  }

  // only shaves off the Z at the end of the string, if it exists
  return value.replace(/Z$/, "");
}
