import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Extract the UTC offset from an ISO 8601 zoned datetime string.
 *
 * - Returns the offset in Temporal's ±HH:MM string form.
 * - This is a value-taking accessor (per J0b's `get/` rule), so it lives in
 *   `parse/` alongside `parseTimeZoneFromZoned`, not `get/`.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns offset string (e.g. "-04:00"), or "" on invalid input
 *
 * @example getZonedOffset("2024-02-29T12:34:56.789+00:00[UTC]") // "+00:00"
 * @example getZonedOffset("2024-07-15T12:00:00-04:00[America/New_York]") // "-04:00"
 * @example getZonedOffset("2024-05-15T12:00:00+05:45[Asia/Kathmandu]") // "+05:45"
 * @example getZonedOffset("invalid") // ""
 */
export function getZonedOffset(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    return Temporal.ZonedDateTime.from(value).offset;
  } catch {
    return "";
  }
}
