import { plainDateTimeOf } from "../../internal/inputChecks";

/**
 * Return the second (0-59) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for second.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromDateTime("2024-03-15T14:30:45") // "45"
 * @example parseSecondFromDateTime("2024-03-15T14:30:00") // "00"
 * @example parseSecondFromDateTime("invalid") // ""
 */
export function parseSecondFromDateTime(value: string): string {
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return dateTime.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
