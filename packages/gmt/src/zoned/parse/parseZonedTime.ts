import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Extract the plain time portion from an ISO 8601 zoned datetime string.
 *
 * - Returns empty string "" for invalid zoned datetime inputs.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain time string (HH:mm:ss[.sss]) or empty string when invalid
 */
export function parseZonedTime(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime?.toPlainTime().toString();
  } catch {
    return "";
  }
}
