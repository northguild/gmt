import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Return the nanosecond (0-999) from a zoned datetime string.
 *
 * - Returns zero-padded string for nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123456789+00:00[UTC]")
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromZoned("2024-03-15T14:30:45.123+00:00[UTC]") // "000"
 * @example parseNanosecondFromZoned("2024-03-15T14:30:45.123456789+00:00[UTC]") // "789"
 * @example parseNanosecondFromZoned("invalid") // ""
 */
export function parseNanosecondFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = zonedDateTimeFrom(value);
    return (zonedDateTime.nanosecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
