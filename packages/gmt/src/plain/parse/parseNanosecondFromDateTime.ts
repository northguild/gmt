import { plainDateTimeOf } from "../../internal/inputChecks";

/**
 * Return the nanosecond (0-999) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromDateTime("2024-03-15T14:30:45.123") // "000"
 * @example parseNanosecondFromDateTime("2024-03-15T14:30:45.123456789") // "789"
 * @example parseNanosecondFromDateTime("2024-03-15T14:30:45.000") // "000"
 * @example parseNanosecondFromDateTime("invalid") // ""
 */
export function parseNanosecondFromDateTime(value: string): string {
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return dateTime.nanosecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
