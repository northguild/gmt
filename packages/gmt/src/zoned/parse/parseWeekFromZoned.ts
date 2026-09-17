import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Return the week of the year for a given ISO 8601 zoned datetime string.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (a value on 2024-12-31
 *   → 1). The result is 1–53.
 * - `"sunday"` numbers weeks within the calendar year, with no week-year rollover: week 1 runs
 *   from 1 January to the first Saturday and each Sunday starts the next week. Late-December days
 *   stay in their own year, so the result is 1–54 (2024-12-31 → 53, 2000-12-31 → 54).
 * - The week is read from the value's own date on its own wall clock.
 * - Returns null for invalid input.
 *
 * @param value ISO zoned datetime string
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53 for "monday", 1-54 for "sunday"), or null on invalid input
 *
 * @example parseWeekFromZoned("2024-01-01T14:30:45.123+00:00[UTC]") // 1
 * @example parseWeekFromZoned("2024-01-08T14:30:45.123+00:00[UTC]") // 2
 * @example parseWeekFromZoned("2024-12-31T12:00:00+00:00[UTC]") // 1 (ISO week 1 of 2025)
 * @example parseWeekFromZoned("2024-12-31T12:00:00+00:00[UTC]", { weekStartsOn: "sunday" }) // 53 (calendar-year weeks, no rollover)
 * @example parseWeekFromZoned("2000-12-31T12:00:00+00:00[UTC]", { weekStartsOn: "sunday" }) // 54 (1 January 2000 was a Saturday, a one-day week 1)
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
    const zonedDateTime = zonedDateTimeFrom(value);
    return getWeekNumber(zonedDateTime.toPlainDate().toString(), weekStartsOn);
  } catch {
    return null;
  }
}
