import { Temporal } from "../../internal/temporal";
import {
  fiscalPeriodOfWeek,
  fiscalYearLabel,
  fiscalYearOf,
  gregorianCycleShift,
  zonelessCalendarDate,
} from "../../internal";
import { isObject } from "../../internal/isObject";
import type { FiscalCalendar } from "../../types";
import { isValidFiscalCalendar } from "../validate";

/** Days in a fiscal week. */
const DAYS_PER_WEEK = 7;

/**
 * Return the fiscal year, period and week `value` falls in, for a 52/53-week retail calendar.
 *
 * 52 × 7 is 364 days, so a 52-week fiscal year drifts a day or two against the sun every year
 * and a 53rd week is inserted every five or six to pull it back. Both the drift and the
 * insertion fall out of `calendar` — nothing here is bundled, because there is no single
 * correct retail calendar.
 *
 * - `calendar.pattern` is the weeks-per-period shape of a quarter: `"4-5-4"`, `"4-4-5"` or
 *   `"5-4-4"`. Four quarters of 13 weeks make the 52-week year.
 * - **`calendar.yearEndsOn` states the year-end *rule*, by example, not one year's end.**
 *   Fiscal years end on that date's weekday, on the occurrence nearest that date's month and
 *   day. One published 4-5-4 example (NRF, US) adds a 53rd week when "there are four or more
 *   days left in January" ([NRF 4-5-4 calendar](https://nrf.com/resources/4-5-4-calendar)),
 *   which puts its year end on the Saturday nearest January 31. As `yearEndsOn` that is
 *   `"2026-01-31"`, a Saturday falling exactly on January 31. Passing a published year end
 *   from a 53-week year instead (`"2024-02-03"`) states a different rule, because that date
 *   sits three days off the target the rule is centred on, and yields a different,
 *   self-consistent calendar.
 * - IFRS 18 ¶29 (formerly IAS 1 ¶37; IFRS 18 applies to reporting periods beginning on or
 *   after 2027-01-01) does not preclude reporting for a 52-week period, and a 53-week year
 *   follows from it. No international standard says where the 53rd week goes or which
 *   calendar year names the fiscal year, and published calendars disagree on both. So
 *   `calendar.extraWeek` and `calendar.yearLabel` are required, and there is no default.
 * - `calendar.extraWeek` is the period a 53rd week is added to: `"firstPeriod"` (ONS, UK: "a
 *   five week January") or `"lastPeriod"` (NRF, US: "to the end of the calendar").
 * - `calendar.yearLabel` names the fiscal year: `"startYear"` (NRF, US), `"endYear"`, the
 *   year its last day falls in, or `"majorityYear"`, the calendar year holding the most days
 *   (ONS, UK). IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) lets a reporting period be identified
 *   by the date it ends, which supports `"endYear"`. GMT rule: a 182/182 split goes to the
 *   end year, for the same reason.
 * - **`year` is not a unique key for every year end.** A 364- or 371-day year drifts against
 *   the calendar, so every label rule has year ends where two fiscal years share a label and a
 *   calendar year names none. `"startYear"` and `"endYear"` do this for year ends near
 *   1 January. Under `yearEndsOn: "2022-12-31"` with `"startYear"`, two fiscal years both start
 *   in 2023, and 2020, 2025 and 2031 name none. `"majorityYear"` does it for year ends near
 *   1 July. Under `yearEndsOn: "2026-07-01"`, 2025-07-03 to 2026-07-01 and 2026-07-02 to
 *   2027-06-30 are both 2026. If your rule falls in such a window, key on the fiscal year's
 *   start date, not on `year`.
 * - A `yearEndsOn` month-day that does not exist in a year follows Temporal's
 *   `overflow: "constrain"`: a February 29 rule reads February 28 in common years. A rule tied
 *   to the end of a month (the weekday nearest to, or last in, the month's final days) would
 *   put a February 28 anchor on February 29 in leap years; this does not — state such a rule
 *   with a date that exists every year.
 * - Whether a fiscal year has 52 or 53 weeks is derived from the gap between its own two
 *   ends, never assumed from a table.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Every date Temporal accepts gets a value, even when its fiscal year runs past
 *   -271821-04-19 or +275760-09-13. The year, period and week are calendar arithmetic, and no
 *   date of the fiscal year is returned.
 * - Returns null on invalid input: a `value` that is not a zoneless ISO date, or a calendar
 *   that is an array or has a missing or unrecognised field. Both share the sentinel, so check
 *   the calendar with `isValidFiscalCalendar` first to tell the two apart.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @param calendar { pattern, yearEndsOn, extraWeek, yearLabel }, all required
 * @returns { year, period, week }, or null on invalid input
 *
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 5, week: 19 }
 * @example getFiscalPeriod("2024-02-04", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 1, week: 1 } (NRF fiscal 2024 opens)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2023, period: 12, week: 53 } (the 53rd week of NRF fiscal 2023)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "endYear" }) // { year: 2024, period: 12, week: 53 } (the same week, named by the year it ends in)
 * @example getFiscalPeriod("2024-03-31", { pattern: "4-4-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 3, week: 9 }
 * @example getFiscalPeriod("2025-02-01", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 5 } (ONS 2025: a five-week January)
 * @example getFiscalPeriod("2024-12-29", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 1 } (ONS 2025 opens in December 2024)
 * @example getFiscalPeriod("+275760-09-13", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 275760, period: 8, week: 32 } (Temporal's last date; its fiscal year closes past it)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (not one of the three patterns)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod" }) // null (no yearLabel)
 * @example getFiscalPeriod("2024-06-15T12:00:00Z", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (a moment, not a calendar date)
 */
export function getFiscalPeriod(
  value: string,
  calendar: FiscalCalendar,
): {
  /** The calendar year that names the fiscal year, chosen by `calendar.yearLabel`. */
  year: number;
  /**
   * The period of the fiscal year, 1 through 12. Each period is four or five weeks long as
   * `calendar.pattern` sets, and a 53rd week belongs to period 1 or period 12, as
   * `calendar.extraWeek` says.
   */
  period: number;
  /**
   * The week of the fiscal year, 1 through 52, or 53 in a year with an inserted week. Week 1 starts
   * on the fiscal year's first day.
   */
  week: number;
} | null {
  try {
    // An array is refused before its fields are copied, as isValidFiscalCalendar refuses it.
    if (!isObject(calendar) || Array.isArray(calendar)) return null;

    // Read each field once: a getter could answer differently on a second read, and the
    // value validated must be the value used.
    const fields = {
      pattern: calendar.pattern,
      yearEndsOn: calendar.yearEndsOn,
      extraWeek: calendar.extraWeek,
      yearLabel: calendar.yearLabel,
    };

    if (!isValidFiscalCalendar(fields)) return null;

    const date = zonelessCalendarDate(value);
    if (!date) return null;

    // A fiscal year near Temporal's first or last date can run past it. Its year, period and
    // week are calendar arithmetic, so work them in the year 2000 to 2399 with the same leap
    // pattern, then move the year back. Period and week do not move.
    const shift = gregorianCycleShift(date.year);
    const local = date.with({ year: date.year - shift });
    const fiscalYear = fiscalYearOf(
      local,
      Temporal.PlainDate.from(fields.yearEndsOn),
    );
    if (!fiscalYear) return null;

    const { start, weeks } = fiscalYear;
    const end = start.add({ days: weeks * DAYS_PER_WEEK - 1 });
    const week =
      Math.floor(
        start.until(local, { largestUnit: "day" }).days / DAYS_PER_WEEK,
      ) + 1;

    return {
      year: fiscalYearLabel(start, end, fields.yearLabel) + shift,
      period: fiscalPeriodOfWeek(week, weeks, fields.pattern, fields.extraWeek),
      week,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
