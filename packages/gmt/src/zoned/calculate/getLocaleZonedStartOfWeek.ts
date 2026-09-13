import { Temporal } from "@js-temporal/polyfill";
import {
  getLocaleFirstDayOfWeek,
  type WeekStartDay,
  zonedUnitStart,
} from "../../internal";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

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
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is
 *   always a real instant, as TC39's `startOfDay()` takes neither.
 * - Distinct from `startOfZoned(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` or `locale` is invalid.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @param options optional: fractionalSecondDigits (number), disambiguation and offset (deprecated, ignored)
 * @returns zoned ISO 8601 string for the start of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US") // "2024-02-25T00:00:00+00:00[UTC]" (Sunday)
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR") // "2024-02-26T00:00:00+00:00[UTC]" (Monday)
 * @example getLocaleZonedStartOfWeek("2024-09-11T12:00:00-03:00[America/Santiago]", "en-US") // "2024-09-08T01:00:00-03:00[America/Santiago]" (that Sunday's midnight was skipped)
 * @example getLocaleZonedStartOfWeek("2018-11-07T12:00:00-02:00[America/Sao_Paulo]", "en-US", { disambiguation: "reject" }) // "2018-11-04T01:00:00-02:00[America/Sao_Paulo]" (the deprecated option is ignored)
 * @example getLocaleZonedStartOfWeek("invalid", "en-US") // ""
 * @example getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "not-a-locale") // ""
 */
export function getLocaleZonedStartOfWeek(
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
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 0;

  if (!isValidZonedDateTime(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const start = zonedUnitStart(
      Temporal.ZonedDateTime.from(value),
      "week",
      firstDay as WeekStartDay,
    );
    return start ? start.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
