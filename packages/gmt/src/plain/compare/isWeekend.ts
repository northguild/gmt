import { Temporal } from "@js-temporal/polyfill";
import { getLocaleWeekendDays } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return true when `value` falls on a weekend day for `locale`.
 *
 * - Uses `Intl.Locale.prototype.weekInfo` to resolve which ISO weekday
 *   numbers count as "weekend" for the locale (e.g. en-US: Sat/Sun,
 *   he-IL/ar-SA: Fri/Sat).
 * - Falls back to Saturday/Sunday if the runtime's `weekInfo` data doesn't
 *   resolve a weekend for the locale.
 * - Returns false if `value` is invalid or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "he-IL"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns false
 * @returns true if `value` is a weekend day in `locale`, false on invalid input
 *
 * @example isWeekend("2024-02-03", "en-US") // true (Saturday, en-US weekend is Sat/Sun)
 * @example isWeekend("2024-02-02", "he-IL") // true (Friday, he-IL weekend is Fri/Sat)
 * @example isWeekend("2024-02-04", "he-IL") // false (Sunday, not part of he-IL's weekend)
 * @example isWeekend("invalid", "en-US") // false
 * @example isWeekend("2024-02-03", "not-a-locale-!!") // false
 * @example isWeekend("2024-05-17", ["ar-EG", "fr-FR"]) // true (Friday is an ar-EG weekend day)
 */
export function isWeekend(value: string, locale: string | string[]): boolean {
  if (!isValidDate(value)) return false;

  const weekendDays = getLocaleWeekendDays(locale);
  if (!weekendDays) return false;

  try {
    const date = Temporal.PlainDate.from(value);
    return weekendDays.has(date.dayOfWeek);
  } catch {
    return false;
  }
}
