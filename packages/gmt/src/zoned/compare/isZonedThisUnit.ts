import { Temporal } from "@js-temporal/polyfill";
import { getLocaleStartOfWeek } from "../../plain/calculate/getLocaleStartOfWeek";
import { areDatesEqualBy } from "../../plain/compare/areDatesEqualBy";
import { isValidDateUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveLocale } from "../../internal/resolveLocale";

/**
 * Return true when `value`'s local calendar day falls in the same `unit` as
 * today, both resolved in `value`'s own IANA timeZone.
 *
 * - Subsumes `isZonedThisWeek`/`isZonedThisMonth`/`isZonedThisYear`; `unit`
 *   is drawn from the same `Temporal.DateUnit` `isThisUnit` uses.
 * - "Today" is resolved in `value`'s own timeZone — no separate timeZone
 *   argument needed, since `value` already carries its IANA timeZone. This
 *   is the deterministic counterpart to `isThisUnit`, which depends on the
 *   system clock and system timeZone.
 * - `locale` only affects the `"week"` case — which day the week starts on
 *   varies by locale. When `unit` is `"week"` and `locale` is given, the
 *   comparison uses `getLocaleStartOfWeek` instead of the ISO Monday-start
 *   default `areDatesEqualBy` otherwise uses.
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - `locale` may be a BCP 47 tag or a preference list of tags (ECMA-402); the first tag with locale
 *   data sets the week start.
 * - Returns false for an unsupported unit or invalid input. The locale is validated for every
 *   unit, so an invalid locale returns false for `"day"`, `"month"` and `"year"` too.
 * - **Compatibility:** before 1.16.0 an invalid locale was ignored for every unit but `"week"`.
 *
 * @param value ISO ZonedDateTime string
 * @param unit date unit to compare by ("year" | "month" | "week" | "day", or its plural)
 * @param locale optional BCP 47 locale tag or preference list — sets the "week" start (e.g. "en-US", ["fr-FR", "en-US"])
 * @returns true if `value`'s local day falls in the same `unit` as today in its own timeZone, false on an unsupported unit or invalid input
 *
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "month") // true, if today is any day in March 2024 in America/New_York
 * @example isZonedThisUnit("2024-02-26T10:00:00+01:00[Europe/Paris]", "week", "fr-FR") // true, if today is 2024-03-01 in Europe/Paris (same fr-FR Monday-start week)
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "hour" as never) // false (unsupported unit)
 * @example isZonedThisUnit("invalid", "month") // false
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "week", "not-a-locale-!!") // false (invalid locale)
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "day", "not-a-locale-!!") // false (invalid locale, for every unit)
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "months") // true, if today is any day in March 2024 in America/New_York
 */
export function isZonedThisUnit(
  value: string,
  unit: Temporal.SmallestUnit<Temporal.DateUnit>,
  locale?: string | string[],
): boolean {
  const resolvedUnit = resolveDateTimeUnit(unit);

  if (
    !isValidZonedDateTime(value) ||
    !isValidDateUnit(resolvedUnit) ||
    (locale !== undefined && resolveLocale(locale) === null)
  ) {
    return false;
  }

  try {
    const zonedDateTime = zonedDateTimeFrom(value);
    const today = Temporal.Now.zonedDateTimeISO(zonedDateTime.timeZoneId)
      .toPlainDate()
      .toString();
    const valueDate = zonedDateTime.toPlainDate().toString();

    if (resolvedUnit === "week" && locale !== undefined) {
      const startOfWeekValue = getLocaleStartOfWeek(valueDate, locale);
      const startOfWeekToday = getLocaleStartOfWeek(today, locale);

      return startOfWeekValue !== "" && startOfWeekValue === startOfWeekToday;
    }

    return areDatesEqualBy(valueDate, today, resolvedUnit);
  } catch {
    return false;
  }
}
