import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number for a given ISO 8601 date string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - `weekStartsOn: "sunday"` is the UTS #35 week of the week-year with a Sunday first day and
 *   minimal days 1 (week 1 holds 1 January, so late-December days can be week 1), while `"monday"`
 *   is the ISO 8601 week of the week-year; both are 1–53 — see `getWeekNumber`.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
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
 * @example parseWeekFromDate("2024-12-31", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 */
export function parseWeekFromDate(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
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
}
