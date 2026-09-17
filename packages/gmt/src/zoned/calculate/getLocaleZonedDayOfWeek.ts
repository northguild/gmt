import { getLocaleFirstDayOfWeek, zonedDateTimeFrom } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the locale-relative day-of-week index for a zoned `value`.
 *
 * - `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR).
 * - Resolves the locale's first day of week via `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday if the runtime's `weekInfo` data doesn't resolve
 *   a first day for the locale.
 * - Returns `null` if `value` is not a valid zoned ISO datetime or `locale` is not a well-formed
 *   BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns null
 * @returns locale-relative day-of-week index (0–6) or null on invalid input
 *
 * @example getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US") // 0 (Sunday)
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "en-US") // 1 (Monday)
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "fr-FR") // 0 (Monday)
 * @example getLocaleZonedDayOfWeek("invalid-zoned", "en-US") // null
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "not-a-locale-!!") // null
 * @example getLocaleZonedDayOfWeek("2024-05-15T12:00:00+02:00[Europe/Berlin]", ["fr-FR", "en-US"]) // 2
 */
export function getLocaleZonedDayOfWeek(
  value: string,
  locale: string | string[],
): number | null {
  if (!isValidZonedDateTime(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const zoned = zonedDateTimeFrom(value);
    return (zoned.dayOfWeek - firstDay + 7) % 7;
  } catch {
    return null;
  }
}
