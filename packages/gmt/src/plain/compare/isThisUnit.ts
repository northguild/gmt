import type { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveLocale } from "../../internal/resolveLocale";
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
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - `locale` may be a BCP 47 tag or a preference list of tags (ECMA-402); the first tag with locale
 *   data sets the week start.
 * - Returns false for an unsupported unit or invalid input. The locale is validated for every
 *   unit, so an invalid locale returns false for `"day"`, `"month"` and `"year"` too.
 * - **Compatibility:** before 1.16.0 an invalid locale was ignored for every unit but `"week"`.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isThisWeek(value, options)` → `isThisUnit(value, "week", locale)`
 * - `isThisMonth(value)` → `isThisUnit(value, "month")`
 * - `isThisYear(value)` → `isThisUnit(value, "year")`
 *
 * @param value ISO PlainDate string
 * @param unit date unit to compare by ("year" | "month" | "week" | "day", or its plural)
 * @param locale optional BCP 47 locale tag or preference list — sets the "week" start (e.g. "en-US", ["fr-FR", "en-US"])
 * @returns true if `value` falls in the same `unit` as today, false on an unsupported unit or invalid input
 *
 * @example isThisUnit("2024-03-15", "month") // true, if today is any day in March 2024
 * @example isThisUnit("2024-03-15", "year") // true, if today is any day in 2024
 * @example isThisUnit("2024-02-26", "week", "fr-FR") // true, if today is 2024-03-01 (same fr-FR Monday-start week)
 * @example isThisUnit("2024-03-15", "hour" as never) // false (unsupported unit)
 * @example isThisUnit("invalid", "month") // false
 * @example isThisUnit("2024-03-15", "week", "not-a-locale-!!") // false (invalid locale)
 * @example isThisUnit("2024-03-15", "day", "not-a-locale-!!") // false (invalid locale, for every unit)
 * @example isThisUnit("2024-03-15", "months") // true, if today is any day in March 2024
 * @example isThisUnit("2024-02-25", "week", ["en-US", "fr-FR"]) // true, if today is 2024-02-29 (en-US Sunday-start week)
 */
export function isThisUnit(
  value: string,
  unit: Temporal.SmallestUnit<Temporal.DateUnit>,
  locale?: string | string[],
): boolean {
  try {
    const resolvedUnit = resolveDateTimeUnit(unit);

    if (
      !isValidDateUnit(resolvedUnit) ||
      (locale !== undefined && resolveLocale(locale) === null)
    ) {
      return false;
    }

    const today = getToday();
    if (today === "") {
      return false;
    }

    if (resolvedUnit === "week" && locale !== undefined) {
      const startOfWeekValue = getLocaleStartOfWeek(value, locale);
      const startOfWeekToday = getLocaleStartOfWeek(today, locale);

      return startOfWeekValue !== "" && startOfWeekValue === startOfWeekToday;
    }

    return areDatesEqualBy(value, today, resolvedUnit);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
