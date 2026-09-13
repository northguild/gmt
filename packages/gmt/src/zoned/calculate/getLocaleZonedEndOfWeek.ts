import { Temporal } from "@js-temporal/polyfill";
import {
  getLocaleFirstDayOfWeek,
  type WeekStartDay,
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
 * - With neither `disambiguation` nor `offset` passed, returns the last
 *   instant of the real local week containing `value` in its own zone —
 *   one nanosecond before the next week bucket starts — so the result is
 *   never before `value`.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock
 *   `.with()` reset to the last instant of the day instead, unchanged from
 *   earlier releases. That result can land before `value` on the other pass
 *   of an overlap.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution
 *   when the end-of-day reset lands on an ambiguous local time:
 *   "compatible" (default, matches Temporal's default), "earlier",
 *   "later", or "reject" (throws, resulting in "").
 * - `offset` (opt-in path) controls whether the source's existing UTC
 *   offset is kept when resetting to end-of-day: "prefer" (Temporal's own
 *   default — keeps the source offset whenever still valid, which **makes
 *   `disambiguation` inert** for almost every case here), "use", "ignore"
 *   (**the default once either option is passed** — always recomputes from
 *   time zone + local time, discarding the stale offset; this is what makes
 *   `disambiguation` actually take effect), or "reject" (throws if the
 *   source offset is invalid for the new fields, independent of
 *   `disambiguation`).
 * - `fractionalSecondDigits` applies on both paths and never opts into
 *   wall-clock resolution.
 * - Distinct from `endOfZoned(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` or `locale` is invalid.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @param options optional: fractionalSecondDigits (number), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore" once either is passed)
 * @returns zoned ISO 8601 string for the end of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US") // "2024-03-02T23:59:59+00:00[UTC]" (Saturday)
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR") // "2024-03-03T23:59:59+00:00[UTC]" (Sunday)
 * @example getLocaleZonedEndOfWeek("invalid", "en-US") // ""
 * @example getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "not-a-locale") // ""
 */
export function getLocaleZonedEndOfWeek(
  value: string,
  locale: string,
  optionsArg?: {
    fractionalSecondDigits?: FractionalDigit;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 0;
  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";

  if (!isValidZonedDateTime(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const source = Temporal.ZonedDateTime.from(value);

    if (
      optionsArg?.disambiguation === undefined &&
      optionsArg?.offset === undefined
    ) {
      const end = zonedUnitEnd(source, "week", firstDay as WeekStartDay);
      return end ? end.toString({ fractionalSecondDigits }) : "";
    }

    const daysToSubtract = (source.dayOfWeek - firstDay + 7) % 7;
    const endOfWeekDate = source.add({ days: 6 - daysToSubtract });
    const result = endOfWeekDate.with(
      {
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      },
      { disambiguation, offset },
    );
    return result.toString({ fractionalSecondDigits });
  } catch {
    return "";
  }
}
