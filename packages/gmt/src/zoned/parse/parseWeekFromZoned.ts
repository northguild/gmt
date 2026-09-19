import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week of the year for a given ISO 8601 zoned datetime string.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (a value on 2024-12-31
 *   → 1). The result is 1–53.
 * - `"sunday"` is the UTS #35 week of the week-year with a Sunday first day and minimal days 1:
 *   week 1 is the Sunday-first week holding 1 January, so late-December days can be week 1 of the
 *   next year (2024-12-31 → 1, 2000-12-30 → 53). The result is 1–53.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
 * - The week is read from the value's own date on its own wall clock.
 * - Returns null for invalid input.
 *
 * @param value ISO zoned datetime string
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns Week number (1-53), or null on invalid input
 *
 * @example parseWeekFromZoned("2024-01-01T14:30:45.123+00:00[UTC]") // 1
 * @example parseWeekFromZoned("2024-01-08T14:30:45.123+00:00[UTC]") // 2
 * @example parseWeekFromZoned("2024-12-31T12:00:00+00:00[UTC]") // 1 (ISO week 1 of 2025)
 * @example parseWeekFromZoned("2024-12-31T12:00:00+00:00[UTC]", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 * @example parseWeekFromZoned("2000-12-31T12:00:00+00:00[UTC]", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2001)
 * @example parseWeekFromZoned("invalid") // null
 */
export function parseWeekFromZoned(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isOptionsArgument(optionsArg)) {
    return null;
  }

  if (!isValidZonedDateTime(value)) {
    return null;
  }

  const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
  if (weekStartsOn === null) return null;

  try {
    const zonedDateTime = zonedDateTimeFrom(value);
    return getWeekNumber(zonedDateTime.toPlainDate().toString(), weekStartsOn);
  } catch {
    return null;
  }
}
