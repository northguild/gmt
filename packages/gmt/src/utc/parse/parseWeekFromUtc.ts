import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";

/**
 * Return the week number from a UTC datetime string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromUtc("2024-03-17T14:30:45Z") // 11
 * @example parseWeekFromUtc("invalid") // null
 */
export function parseWeekFromUtc(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isValidUtc(value)) return null;

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const instant = Temporal.Instant.from(value);
    const dt = instant.toZonedDateTimeISO("UTC");
    const dateStr = `${dt.year}-${dt.month.toString().padStart(2, "0")}-${dt.day.toString().padStart(2, "0")}`;
    return getWeekNumber(dateStr, weekStartsOn);
  } catch {
    return null;
  }
}
