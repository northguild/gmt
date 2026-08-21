import { Temporal } from "@js-temporal/polyfill";
import { getLocaleStartOfWeek } from "../../plain/calculate/getLocaleStartOfWeek";
import { areDatesEqualBy } from "../../plain/compare/areDatesEqualBy";
import { isValidDateUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate";

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
 * - Returns false for an unsupported unit, invalid input, or an invalid locale.
 *
 * @param value ISO ZonedDateTime string
 * @param unit Temporal.DateUnit to compare by ("year" | "month" | "week" | "day")
 * @param locale optional BCP 47 locale tag — only affects the "week" case (e.g. "en-US", "fr-FR")
 * @returns true if `value`'s local day falls in the same `unit` as today in its own timeZone, false on an unsupported unit or invalid input
 *
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "month") // true, if today is any day in March 2024 in America/New_York
 * @example isZonedThisUnit("2024-02-26T10:00:00+01:00[Europe/Paris]", "week", "fr-FR") // true, if today is 2024-03-01 in Europe/Paris (same fr-FR Monday-start week)
 * @example isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "hour" as never) // false (unsupported unit)
 * @example isZonedThisUnit("invalid", "month") // false
 */
export function isZonedThisUnit(
  value: string,
  unit: Temporal.DateUnit,
  locale?: string,
): boolean {
  if (!isValidZonedDateTime(value) || !isValidDateUnit(unit)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const today = Temporal.Now.zonedDateTimeISO(zonedDateTime.timeZoneId)
      .toPlainDate()
      .toString();
    const valueDate = zonedDateTime.toPlainDate().toString();

    if (unit === "week" && locale !== undefined) {
      const startOfWeekValue = getLocaleStartOfWeek(valueDate, locale);
      const startOfWeekToday = getLocaleStartOfWeek(today, locale);

      return startOfWeekValue !== "" && startOfWeekValue === startOfWeekToday;
    }

    return areDatesEqualBy(valueDate, today, unit);
  } catch {
    return false;
  }
}
