import {
  getLocaleFirstDayOfWeek,
  type WeekStartDay,
  zonedDateTimeFrom,
  zonedUnitEnd,
} from "../../internal";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the end of the week containing `value`, using `locale`'s first
 * day of week (e.g. en-US: week ends Saturday, fr-FR: week ends Sunday).
 *
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday-start (so the week ends Sunday) if the runtime's
 *   `weekInfo` data doesn't resolve a first day for the locale.
 * - Returns the last instant of the real local week containing `value` in
 *   its own zone — one nanosecond before the next week bucket starts — so
 *   the result is never before `value`.
 * - The end is written at nanosecond precision by default (`.999999999`), like `endOfZoned`, so the
 *   string names the end itself. An explicit `fractionalSecondDigits` truncates it, as Temporal's
 *   `toString` does; pass `{ fractionalSecondDigits: 0 }` to keep the previous whole-second string.
 * - Distinct from `endOfZoned(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` is invalid or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns ""
 * @param options optional: fractionalSecondDigits (number, default 9)
 * @returns zoned ISO 8601 string for the end of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US") // "2024-03-02T23:59:59.999999999+00:00[UTC]" (Saturday)
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR") // "2024-03-03T23:59:59.999999999+00:00[UTC]" (Sunday)
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US", { fractionalSecondDigits: 0 }) // "2024-03-02T23:59:59+00:00[UTC]" (the pre-1.16.0 string)
 * @example getLocaleZonedEndOfWeek("invalid", "en-US") // ""
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "not-a-locale-!!") // ""
 * @example getLocaleZonedEndOfWeek("2024-05-15T12:00:00+02:00[Europe/Berlin]", ["fr-FR", "en-US"]) // "2024-05-19T23:59:59.999999999+02:00[Europe/Berlin]"
 */
export function getLocaleZonedEndOfWeek(
  value: string,
  locale: string | string[],
  optionsArg?: {
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }

  const fractionalSecondDigits =
    optionsArg?.fractionalSecondDigits === undefined
      ? 9
      : optionsArg.fractionalSecondDigits;

  if (!isValidZonedDateTime(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const end = zonedUnitEnd(
      zonedDateTimeFrom(value),
      "week",
      firstDay as WeekStartDay,
    );
    return end ? end.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
