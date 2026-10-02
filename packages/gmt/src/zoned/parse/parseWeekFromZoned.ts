import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week of the year for a given ISO 8601 zoned datetime string.
 *
 * - `"monday"` is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (a value on 2024-12-31
 *   → 1). The result is 1–53.
 * - `"sunday"` is the UTS #35 week of the week-year with a Sunday first day and minimal days 1:
 *   week 1 is the Sunday-first week holding 1 January, so late-December days can be week 1 of the
 *   next year (2024-12-31 → 1, 2000-12-30 → 53). The result is 1–53.
 * - The week is read from the value's own date on its own wall clock.
 * - Returns null for invalid input.
 *
 * @param value ISO zoned datetime string
 * @param optionsArg optional setting for the week's first day
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
  optionsArg?: {
    /**
     * The first day of the week, which sets how the week is numbered. `"monday"` gives the ISO 8601
     * week number, where week 1 holds the year's first Thursday; `"sunday"` gives the UTS #35 week
     * number with a Sunday first day and one minimal day, where week 1 holds 1 January. Any other
     * value returns null.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  try {
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
      return getWeekNumber(
        zonedDateTime.toPlainDate().toString(),
        weekStartsOn,
      );
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
