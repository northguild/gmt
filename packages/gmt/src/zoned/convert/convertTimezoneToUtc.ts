import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Convert an ISO 8601 zoned datetime string to a UTC Instant string (ISO).
 *
 * - Accepts a zoned ISO 8601 datetime string and returns an Instant string
 *   (e.g. "2024-02-29T00:00:00Z").
 * - On invalid input returns an empty string "".
 *
 * @param value zoned ISO 8601 datetime string
 * @returns UTC Instant ISO string or empty string when invalid
 */
export function convertTimezoneToUtc(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    return Temporal.ZonedDateTime.from(value).toInstant().toString();
  } catch {
    return "";
  }
}
