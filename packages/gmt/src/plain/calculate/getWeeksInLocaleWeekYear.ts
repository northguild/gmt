// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";

import {
  getLocaleFirstDayOfWeek,
  getLocaleWeekYearBounds,
  resolveMinimalDaysInFirstWeek,
} from "../../internal";
import { isValidDate } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the number of weeks (52 or 53) in the locale week-numbering year containing `value`, from
 * `locale`'s first day of week and a minimal-days-in-first-week rule.
 *
 * - `getWeeksInYear`'s locale-relative counterpart: that function uses the fixed ISO rule, this one
 *   uses `locale`'s first day of week, and the two can disagree on the same date.
 * - Computed as the calendar days between this week-year's start and the next one's, divided by 7 —
 *   always whole, since both starts fall on the locale's first day of week. Counted by day
 *   arithmetic, so a start outside the representable range still counts.
 * - **`minimalDays` defaults to `4`, the ISO 8601 rule, on every runtime.** ECMA-402 does not expose
 *   a locale's minimal days (tc39/proposal-intl-locale-info#86). CLDR 48's world default is `1`
 *   (`US` included) and `4` is set for mostly European regions; pass the locale's value when it
 *   differs. See `getLocaleWeekYear`.
 * - Returns null if `value` or `locale` is invalid, or if `minimalDays` is not an integer from 1 to 7.
 * - **Compatibility:** before 1.16.0 the default read the runtime's `minimalDays` where one was
 *   exposed (Node 22), so a locale such as `en-US` got `1` there and `4` on Node 24 and later. Pass
 *   `{ minimalDays: 1 }` to keep the Node 22 result for such a locale on every runtime.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns null
 * @param options optional: minimalDays (integer 1–7, default 4)
 * @returns 52 or 53, or null on invalid input
 *
 * @example getWeeksInLocaleWeekYear("2024-06-15", "en-US") // 52
 * @example getWeeksInLocaleWeekYear("2022-06-15", "en-US", { minimalDays: 1 }) // 53 — Dec 26, 2021 to Jan 1, 2023
 * @example getWeeksInLocaleWeekYear("2022-06-15", "en-US") // 52 — ISO default: Jan 2, 2022 to Jan 1, 2023
 * @example getWeeksInLocaleWeekYear("2020-06-15", "de-DE") // 53
 * @example getWeeksInLocaleWeekYear("2024-06-15", "en-US", { minimalDays: 8 }) // null
 * @example getWeeksInLocaleWeekYear("+275760-09-13", "en-US") // 53 (its end, the week 1 of +275761, lies past the range)
 * @example getWeeksInLocaleWeekYear("invalid", "en-US") // null
 * @example getWeeksInLocaleWeekYear("2024-12-29", ["fr-FR", "en-US"]) // 52
 */
export function getWeeksInLocaleWeekYear(
  value: string,
  locale: string | string[],
  options?: { minimalDays?: number },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    if (!isValidDate(value)) return null;

    const firstDay = getLocaleFirstDayOfWeek(locale);
    const minimalDays = resolveMinimalDaysInFirstWeek(options);
    if (firstDay === null || minimalDays === null) return null;

    try {
      const date = Temporal.PlainDate.from(value);
      const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
        date,
        firstDay,
        minimalDays,
      );
      return (endOffsetDays - startOffsetDays) / 7;
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
