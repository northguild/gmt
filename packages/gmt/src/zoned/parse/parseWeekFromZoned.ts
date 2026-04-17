import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the week of the year (1-53) for a given ISO 8601 zoned datetime string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - Returns null for invalid input.
 *
 * @param value ISO zoned datetime string
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromZoned("2024-01-01T14:30:45.123+00:00[UTC]") // 1
 * @example parseWeekFromZoned("2024-01-08T14:30:45.123+00:00[UTC]") // 2
 * @example parseWeekFromZoned("invalid") // null
 */
export function parseWeekFromZoned(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isValidZonedDateTime(value)) {
    return null;
  }

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return getWeekNumber(
      `${zonedDateTime.year}-${zonedDateTime.month.toString().padStart(2, "0")}-${zonedDateTime.day.toString().padStart(2, "0")}`,
      weekStartsOn,
    );
  } catch {
    return null;
  }
}
