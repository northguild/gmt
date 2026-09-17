import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";

/**
 * Return the week number from a UTC datetime string.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (a value on 2024-12-31
 *   → 1). The result is 1–53.
 * - `"sunday"` numbers weeks within the calendar year, with no week-year rollover: week 1 runs
 *   from 1 January to the first Saturday and each Sunday starts the next week. Late-December days
 *   stay in their own year, so the result is 1–54 (2024-12-31 → 53, 2000-12-31 → 54).
 * - The week is read from the value's own date in UTC.
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53 for "monday", 1-54 for "sunday"), or null on invalid input
 *
 * @example parseWeekFromUtc("2024-03-17T14:30:45Z") // 11
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z") // 1 (ISO week 1 of 2025)
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 53 (calendar-year weeks, no rollover)
 * @example parseWeekFromUtc("2000-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 54 (1 January 2000 was a Saturday, a one-day week 1)
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
    const dateStr = dt.toPlainDate().toString();
    return getWeekNumber(dateStr, weekStartsOn);
  } catch {
    return null;
  }
}
