import type { Temporal } from "@js-temporal/polyfill";
import { getLocaleStartOfWeek } from "../calculate/getLocaleStartOfWeek";
import { getToday } from "../get/getToday";
import { isValidDateUnit } from "../validate";
import { areDatesEqualBy } from "./areDatesEqualBy";

/**
 * Return true when `value` falls in the same `unit` as today, per the
 * system clock and system timeZone.
 *
 * - Subsumes `isThisWeek`/`isThisMonth`/`isThisYear`: `unit` is drawn from
 *   the same `Temporal.DateUnit` `areDatesEqualBy` uses.
 * - `"day"` is equivalent to `isRelativeDay(value, 0)`.
 * - `locale` only affects the `"week"` case — which day the week starts on
 *   varies by locale (e.g. en-US: Sunday, fr-FR: Monday). When `unit` is
 *   `"week"` and `locale` is given, the comparison uses `getLocaleStartOfWeek`
 *   instead of the ISO Monday-start default `areDatesEqualBy` otherwise uses.
 * - Compares against `getToday()`, so this depends on the **system clock and
 *   system timeZone**. A caller needing determinism should use
 *   `isZonedThisUnit` with an explicit timeZone, or compare against an
 *   explicit reference with `areDatesEqualBy`.
 * - Returns false for an unsupported unit, invalid input, or an invalid locale.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isThisWeek(value, options)` → `isThisUnit(value, "week", locale)`
 * - `isThisMonth(value)` → `isThisUnit(value, "month")`
 * - `isThisYear(value)` → `isThisUnit(value, "year")`
 *
 * @param value ISO PlainDate string
 * @param unit Temporal.DateUnit to compare by ("year" | "month" | "week" | "day")
 * @param locale optional BCP 47 locale tag — only affects the "week" case (e.g. "en-US", "fr-FR")
 * @returns true if `value` falls in the same `unit` as today, false on an unsupported unit or invalid input
 *
 * @example isThisUnit("2024-03-15", "month") // true, if today is any day in March 2024
 * @example isThisUnit("2024-03-15", "year") // true, if today is any day in 2024
 * @example isThisUnit("2024-02-26", "week", "fr-FR") // true, if today is 2024-03-01 (same fr-FR Monday-start week)
 * @example isThisUnit("2024-03-15", "hour" as never) // false (unsupported unit)
 * @example isThisUnit("invalid", "month") // false
 */
export function isThisUnit(
  value: string,
  unit: Temporal.DateUnit,
  locale?: string,
): boolean {
  if (!isValidDateUnit(unit)) {
    return false;
  }

  const today = getToday();
  if (today === "") {
    return false;
  }

  if (unit === "week" && locale !== undefined) {
    const startOfWeekValue = getLocaleStartOfWeek(value, locale);
    const startOfWeekToday = getLocaleStartOfWeek(today, locale);

    return startOfWeekValue !== "" && startOfWeekValue === startOfWeekToday;
  }

  return areDatesEqualBy(value, today, unit);
}
