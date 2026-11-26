import { plainDateOf } from "../../internal/inputChecks";

/**
 * Return the ISO week number for a given ISO 8601 date string.
 *
 * - Uses Temporal.PlainDate.weekOfYear (Monday-based ISO weeks).
 * - Returns null for invalid input.
 *
 * @param value ISO 8601 date string
 * @returns Week number (1-53) or null on invalid input
 *
 * @example weekOfYearForDate("2024-01-01") // 1
 * @example weekOfYearForDate("2024-01-07") // 1
 * @example weekOfYearForDate("2024-01-08") // 2
 * @example weekOfYearForDate("2024-12-31") // 1
 * @example weekOfYearForDate("invalid") // null
 */
export function weekOfYearForDate(value: string): number | null {
  const date = plainDateOf(value);
  if (date === null) return null;

  try {
    return date.weekOfYear ?? null;
  } catch {
    return null;
  }
}
