import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number for a given ISO 8601 date string.
 *
 * - The week is the week of the week-year, 1–53, under either numbering — see `getWeekNumber`.
 * - Returns null for invalid input.
 *
 * @param value ISO date string
 * @param optionsArg How weeks are numbered
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromDate("2024-01-01") // 1
 * @example parseWeekFromDate("2024-01-08") // 2
 * @example parseWeekFromDate("2024-12-31") // 1
 * @example parseWeekFromDate("2024-01-01", { weekStartsOn: "sunday" }) // 1
 * @example parseWeekFromDate("invalid") // null
 * @example parseWeekFromDate("2024-12-31", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 */
export function parseWeekFromDate(
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

    if (!isValidDate(value)) {
      return null;
    }
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
    if (weekStartsOn === null) return null;

    try {
      return getWeekNumber(value, weekStartsOn);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
