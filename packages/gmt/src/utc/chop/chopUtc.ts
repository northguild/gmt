import { isValidUtc } from "../validate";

/**
 * Return the UTC datetime string with a trailing Z removed if present.
 *
 * - Only removes a trailing 'Z' or 'z' from valid UTC datetime strings.
 * - Returns an empty string for invalid input.
 *
 * @param value UTC datetime string (ISO 8601)
 * @returns UTC datetime string without trailing Z or "" on invalid input
 */
export function chopUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  // only shaves off z or Z at the end of the string, if it exists
  return value.replace(/z$/i, "");
}
