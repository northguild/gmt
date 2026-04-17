import { isValidUtc } from "../validate";

/**
 * Return the UTC datetime string with a trailing Z removed if present.
 *
 * - Uses regex to remove trailing "z" or "Z".
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (ISO 8601)
 * @returns UTC datetime string without trailing Z or "" on invalid input
 *
 * @example chopUtc("2024-03-10T12:00:00Z") // "2024-03-10T12:00:00"
 * @example chopUtc("2024-03-10T12:00:00") // "2024-03-10T12:00:00"
 * @example chopUtc("invalid") // ""
 */
export function chopUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  // only shaves off z or Z at the end of the string, if it exists
  return value.replace(/z$/i, "");
}
