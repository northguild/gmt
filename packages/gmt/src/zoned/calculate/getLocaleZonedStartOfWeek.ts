import {
  getLocaleFirstDayOfWeek,
  type WeekStartDay,
  zonedDateTimeFrom,
  zonedUnitStart,
} from "../../internal";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the week containing `value`, using `locale`'s
 * first day of week (e.g. en-US: Sunday, fr-FR: Monday).
 *
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday if the runtime's `weekInfo` data doesn't resolve
 *   a first day for the locale.
 * - Returns the real start of the local week containing `value` in its own
 *   zone — the same kind of bucket `floorToZone` uses — so the result is
 *   never after `value`. A week whose first midnight was skipped starts at
 *   its first real instant.
 * - Distinct from `startOfZoned(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` is invalid or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns ""
 * @param options optional: fractionalSecondDigits (number)
 * @returns zoned ISO 8601 string for the start of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US") // "2024-02-25T00:00:00+00:00[UTC]" (Sunday)
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR") // "2024-02-26T00:00:00+00:00[UTC]" (Monday)
 * @example getLocaleZonedStartOfWeek("2024-09-11T12:00:00-03:00[America/Santiago]", "en-US") // "2024-09-08T01:00:00-03:00[America/Santiago]" (that Sunday's midnight was skipped)
 * @example getLocaleZonedStartOfWeek("invalid", "en-US") // ""
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "not-a-locale-!!") // ""
 * @example getLocaleZonedStartOfWeek("2024-05-15T12:00:00+02:00[Europe/Berlin]", ["en-US", "fr-FR"]) // "2024-05-12T00:00:00+02:00[Europe/Berlin]"
 */
export function getLocaleZonedStartOfWeek(
  value: string,
  locale: string | string[],
  optionsArg?: {
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }

  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 0;

  if (!isValidZonedDateTime(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const start = zonedUnitStart(
      zonedDateTimeFrom(value),
      "week",
      firstDay as WeekStartDay,
    );
    return start ? start.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
