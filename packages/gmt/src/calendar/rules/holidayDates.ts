import {
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "../../internal/businessCalendar";
import { isoDateString } from "../../internal/epochDay";
import {
  holidayEpochDays,
  parseHolidayRule,
  ruleNeedsCalendar,
} from "../../internal/holidayRules";
import { isOptionsArgument } from "../../internal/isObject";
import type { HolidayDatesOptions, HolidayRule } from "../../types";

/** Temporal's ISO year range: -271821-04-19 to +275760-09-13 (TC39 ISODateWithinLimits). */
const MIN_YEAR = -271_821;
const MAX_YEAR = 275_760;

/**
 * Every date a holiday rule produces in an ISO year, as sorted ISO PlainDate strings.
 *
 * - **Year meaning.** The result holds each occurrence whose *unshifted* date lies in ISO `year`,
 *   at its observed date: the occurrence itself when the rule's policy does not move it, otherwise
 *   the date it moves to, which replaces it, even when the move crosses into another year.
 *   `fixed` 1 January observed `{ 6: { previous: 5 } }` gives `["2027-12-31"]` for 2028. A `fixed`,
 *   `nthWeekday` or `easterRelative` rule gives 0 or 1 dates, a `calendarFixed` rule 0, 1 or 2,
 *   and a `dates` rule each of its dates in the year.
 * - A moved holiday is returned only on its observed date. To close both the date and its
 *   observed date, list the rule twice: once without `observed`, once with it.
 *   Collecting the closures that fall in a window of years is `buildBusinessCalendar`'s job.
 * - A date a year lacks (29 February in a common year, `M05L` in a common Hebrew year, day 30 of a
 *   29-day month) is skipped, never moved or clamped (RFC 5545 §3.3.10; RFC 7529 §4.1).
 * - `calendarFixed` is the calendar's *computed* date (an observed sighting is a `dates` rule
 *   instead). Aliases such as `islamicc` are accepted; `chinese` and `dangi` are not.
 * - `easterRelative` counts from Easter Sunday by the Gregorian method (or `computus: "julian"`),
 *   applied proleptically before 1583.
 * - A policy that uses `"nextWorkingDay"` needs `options.calendar`; without one the result is
 *   `[]` whatever the year. A supplied calendar is validated even when the rule never uses it.
 * - A shift that leaves Temporal's range (-271821-04-19 to +275760-09-13) gives `[]`.
 * - Never throws. Use `isValidHolidayRule` to tell an invalid rule from a year with no occurrence.
 *
 * @param rule the holiday rule; its `name` is a label and never part of the result
 * @param year ISO year, an integer from -271821 to 275760
 * @param options which days are open, for a rule that shifts to the next working day
 * @returns sorted ISO PlainDate strings, or `[]` when the rule, year or options are invalid or the year has no occurrence
 *
 * @example holidayDates({ name: "Closing day", kind: "easterRelative", offsetDays: -2 }, 2024) // ["2024-03-29"] — Easter − 2
 * @example holidayDates({ name: "Third Monday", kind: "nthWeekday", month: 1, weekday: 1, n: 3 }, 2026) // ["2026-01-19"]
 * @example holidayDates({ name: "1 Shawwal 1447", kind: "calendarFixed", calendar: "islamic-umalqura", monthCode: "M10", day: 1 }, 2026) // ["2026-03-20"] — 1 Shawwal 1447 in islamic-umalqura
 * @example holidayDates({ name: "New year", kind: "fixed", month: 1, day: 1, observed: { 6: { previous: 5 } } }, 2028) // ["2027-12-31"] — Saturday moves to the Friday before, in the previous year
 * @example holidayDates({ name: "Leap day", kind: "fixed", month: 2, day: 29 }, 2026) // [] — 2026 has no 29 February
 * @example holidayDates({ name: "Bad", kind: "fixed", month: 13, day: 1 }, 2026) // [] — invalid rule
 */
export function holidayDates(
  rule: HolidayRule,
  year: number,
  options?: HolidayDatesOptions,
): string[] {
  try {
    if (!isOptionsArgument(options)) {
      return [];
    }

    const calendar = options?.calendar;
    let resolvedCalendar: ResolvedBusinessCalendar | null = null;

    if (calendar !== undefined) {
      resolvedCalendar = parseBusinessCalendar(calendar);

      if (resolvedCalendar === null) {
        return [];
      }
    }

    const resolved = parseHolidayRule(rule);

    if (
      resolved === null ||
      !Number.isInteger(year) ||
      year < MIN_YEAR ||
      year > MAX_YEAR ||
      (ruleNeedsCalendar(resolved) && resolvedCalendar === null)
    ) {
      return [];
    }

    const days = holidayEpochDays(resolved, year, resolvedCalendar);

    return days === null ? [] : days.map(isoDateString);
  } catch {
    // Never throws (Core Rule 3): an unreadable calendar or a walk past Temporal's range is an
    // invalid result.
    return [];
  }
}
