import { isoStringBody } from "../../internal/isoStringBody";
import { isValidUtc } from "../validate";

/**
 * Return the UTC datetime string with a trailing Z removed if present.
 *
 * - Removes the trailing "Z"; a lower-case "z" is not a GMT UTC string (`isValidUtc`), so it returns "".
 * - Drops the RFC 9557 annotations `Temporal.Instant.from` ignores (`[foo=bar]`, `[Europe/Paris]`).
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (ISO 8601)
 * @returns UTC datetime string without trailing Z or "" on invalid input
 *
 * @example chopUtc("2024-03-10T12:00:00Z") // "2024-03-10T12:00:00"
 * @example chopUtc("2024-03-10T12:00:00") // "" (no Z: not a UTC instant)
 * @example chopUtc("2024-03-10T12:00:00z") // "" (lower-case z)
 * @example chopUtc("invalid") // ""
 * @example chopUtc("2024-03-10T12:00:00Z[foo=bar]") // "2024-03-10T12:00:00"
 */
export function chopUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  // only shaves off the Z at the end of the string, if it exists
  return isoStringBody(value).replace(/Z$/, "");
}
