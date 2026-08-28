import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the ISO week number for a given ISO 8601 datetime string.
 *
 * - Uses Temporal.PlainDate.weekOfYear (Monday-based ISO weeks).
 * - Returns null for invalid input.
 *
 * @param value ISO 8601 datetime string
 * @returns Week number (1-53) or null on invalid input
 *
 * @example weekOfYearForDateTime("2024-01-01T12:00:00") // 1
 * @example weekOfYearForDateTime("2024-01-08T00:00:00") // 2
 * @example weekOfYearForDateTime("invalid") // null
 */
export function weekOfYearForDateTime(value: string): number | null {
  if (!isValidDateTime(value)) return null;

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    const date = Temporal.PlainDate.from({
      year: dateTime.year,
      month: dateTime.month,
      day: dateTime.day,
    });
    return date.weekOfYear ?? null;
  } catch {
    return null;
  }
}
