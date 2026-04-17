import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDateTime } from "../validate";

/**
 * Return the week number for a given ISO 8601 datetime string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - Returns null for invalid input.
 *
 * @param value ISO 8601 datetime string
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromDateTime("2024-01-01T12:00:00") // 1
 * @example parseWeekFromDateTime("2024-01-08T00:00:00") // 2
 * @example parseWeekFromDateTime("2024-01-01T00:00:00", { weekStartsOn: "sunday" }) // 1
 * @example parseWeekFromDateTime("invalid") // null
 */
export function parseWeekFromDateTime(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isValidDateTime(value)) {
    return null;
  }
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    return getWeekNumber(value, weekStartsOn);
  } catch {
    return null;
  }
}
