import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Extract the plain date portion from an ISO 8601 zoned datetime string.
 *
 * - Extracts date components from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain ISO date string (YYYY-MM-DD) or "" when invalid
 *
 * @example parseDateFromZoned("2024-02-29T12:34:56.789+00:00[UTC]") // "2024-02-29"
 * @example parseDateFromZoned("invalid") // ""
 */
export function parseDateFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime?.toPlainDate().toString();
  } catch {
    return "";
  }
}
