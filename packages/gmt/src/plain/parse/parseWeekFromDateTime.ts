import { Temporal } from "@js-temporal/polyfill";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number for a given ISO 8601 datetime string.
 *
 * - By default uses ISO weeks (Monday-based).
 * - `weekStartsOn: "sunday"` is the UTS #35 week of the week-year with a Sunday first day and
 *   minimal days 1 (week 1 holds 1 January, so late-December days can be week 1), while `"monday"`
 *   is the ISO 8601 week of the week-year; both are 1–53 — see `getWeekNumber`.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
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
 * @example parseWeekFromDateTime("2024-12-31T12:00:00", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 */
export function parseWeekFromDateTime(
  value: string,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): number | null {
  if (!isOptionsArgument(optionsArg)) {
    return null;
  }

  if (!isValidDateTime(value)) {
    return null;
  }
  const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
  if (weekStartsOn === null) return null;

  try {
    // getWeekNumber takes a PlainDate string only, so pass the date half.
    return getWeekNumber(
      Temporal.PlainDateTime.from(value).toPlainDate().toString(),
      weekStartsOn,
    );
  } catch {
    return null;
  }
}
