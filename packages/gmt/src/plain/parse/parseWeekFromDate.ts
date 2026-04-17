import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";

/**
 * Return the week number for a given ISO 8601 date string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - Returns null for invalid input.
 *
 * @param value ISO date string
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromDate("2024-01-01") // 1
 * @example parseWeekFromDate("2024-01-08") // 2
 * @example parseWeekFromDate("2024-12-31") // 1
 * @example parseWeekFromDate("2024-01-01", { weekStartsOn: "sunday" }) // 1
 * @example parseWeekFromDate("invalid") // null
 */
export function parseWeekFromDate(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isValidDate(value)) {
    return null;
  }
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    return getWeekNumber(value, weekStartsOn);
  } catch {
    return null;
  }
}
