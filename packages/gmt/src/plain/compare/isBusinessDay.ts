import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return true when `value` falls on a Monday–Friday ISO business day.
 *
 * - Uses the fixed ISO Monday–Friday business-day boundary (Mon=1 … Fri=5),
 *   matching the definition used by `addBusinessDays`/`subtractBusinessDays`.
 * - Locale-agnostic: no `Intl.Locale` lookup and no holiday calendar.
 * - Returns false if `value` is invalid.
 *
 * This is the locale-agnostic complement to the locale-aware `isWeekend`: `isWeekend`
 * resolves weekend days per locale via `Intl.Locale.prototype.weekInfo`, whereas
 * `isBusinessDay` always treats Monday–Friday as business days regardless of locale.
 *
 * @param value ISO PlainDate string
 * @returns true if `value` is a Monday–Friday business day, false on invalid input
 *
 * @example isBusinessDay("2024-02-05") // true (Monday)
 * @example isBusinessDay("2024-02-10") // false (Saturday)
 * @example isBusinessDay("2024-02-04") // false (Sunday)
 * @example isBusinessDay("invalid") // false
 */
export function isBusinessDay(value: string): boolean {
  if (!isValidDate(value)) return false;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.dayOfWeek >= 1 && date.dayOfWeek <= 5;
  } catch {
    return false;
  }
}
