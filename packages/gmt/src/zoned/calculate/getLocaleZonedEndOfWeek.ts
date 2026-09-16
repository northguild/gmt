import {
  getLocaleFirstDayOfWeek,
  type WeekStartDay,
  zonedDateTimeFrom,
  zonedUnitEnd,
} from "../../internal";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

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
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is
 *   always a real instant, as TC39's `startOfDay()` takes neither.
 * - Distinct from `endOfZoned(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` is invalid or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @param options optional: fractionalSecondDigits (number, default 9), disambiguation and offset (deprecated, ignored)
 * @returns zoned ISO 8601 string for the end of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US") // "2024-03-02T23:59:59.999999999+00:00[UTC]" (Saturday)
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR") // "2024-03-03T23:59:59.999999999+00:00[UTC]" (Sunday)
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US", { fractionalSecondDigits: 0 }) // "2024-03-02T23:59:59+00:00[UTC]" (the pre-1.16.0 string)
 * @example getLocaleZonedEndOfWeek("2014-02-12T12:00:00-02:00[America/Sao_Paulo]", "en-US", { disambiguation: "reject" }) // "2014-02-15T23:59:59.999999999-03:00[America/Sao_Paulo]" (Saturday's last hour repeats; the week ends on the second pass and the deprecated option is ignored)
 * @example getLocaleZonedEndOfWeek("invalid", "en-US") // ""
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "not-a-locale-!!") // ""
 */
export function getLocaleZonedEndOfWeek(
  value: string,
  locale: string,
  optionsArg?: {
    fractionalSecondDigits?: FractionalDigit;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
  },
): string {
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 9;

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
