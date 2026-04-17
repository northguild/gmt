import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the microsecond (0-999) from a zoned datetime string.
 *
 * - Returns zero-padded string for microsecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123456+00:00[UTC]")
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromZoned("2024-03-15T14:30:45.123+00:00[UTC]") // "123"
 * @example parseMicrosecondFromZoned("invalid") // ""
 */
export function parseMicrosecondFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return (zonedDateTime.microsecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
