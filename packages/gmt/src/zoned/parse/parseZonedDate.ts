import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Extract the plain date portion from an ISO 8601 zoned datetime string.
 *
 * - Returns empty string "" for invalid zoned datetime inputs.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain ISO date string (YYYY-MM-DD) or empty string when invalid
 */
export function parseZonedDate(value: string): string {
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
