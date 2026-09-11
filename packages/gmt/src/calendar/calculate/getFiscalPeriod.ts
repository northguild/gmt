import { Temporal } from "@js-temporal/polyfill";
import {
  fiscalPeriodOfWeek,
  fiscalYearOf,
  isFiscalPattern,
  zonelessCalendarDate,
} from "../../internal";
import { isValidDate } from "../../plain/validate";
import type { FiscalCalendar } from "../../types";

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
 * - `calendar.pattern` is the weeks-per-period shape of a quarter: `"4-5-4"` (the NRF retail
 *   standard), `"4-4-5"` or `"5-4-4"`. Four quarters of 13 weeks make the 52-week year.
 * - **`calendar.yearEndsOn` states the year-end *rule*, by example, not one year's end.**
 *   Fiscal years end on that date's weekday, on the occurrence nearest that date's month and
 *   day. The NRF's published rule — "the Saturday nearest to January 31"
 *   ([NRF 4-5-4 calendar](https://nrf.com/resources/4-5-4-calendar)) — is `"2026-01-31"`, a
 *   Saturday falling exactly on January 31. Passing a published year end from a 53-week year
 *   instead (`"2024-02-03"`) states a different rule, because that date sits three days off
 *   the target the rule is centred on, and yields a different, self-consistent calendar.
 * - `week` is the week of the fiscal year, 1–53, the numbering the NRF publishes. `period` is
 *   1–12. A 53rd week is appended to period 12 — the NRF adds it "to the end of the
 *   calendar", which makes a 4-5-4 year's final quarter 4-5-5.
 * - **`year` is the calendar year the fiscal year starts in**, matching the NRF: fiscal 2023
 *   runs 2023-01-29 to 2024-02-03. Organisations labelling by the end year should add one.
 * - **`year` is not a unique key for a rule anchored near 1 January.** A 52/53-week year is
 *   364 or 371 days, so it drifts against the calendar, and no label taken from a calendar
 *   year survives that for every anchor. Under `yearEndsOn: "2027-01-02"` — "the Saturday
 *   nearest to 31 December", a common convention — two consecutive fiscal years both start in
 *   2023 and share the label, and 2018, 2024 and 2029 label no fiscal year at all. Grouping by
 *   `year` there merges 104 weeks and drops a year. January/February anchors like the NRF's
 *   are unaffected. If your rule sits near a year boundary, key on the fiscal year's own start
 *   date — which `yearEndsOn` determines, and which is yours to enumerate — not on `year`.
 *   GMT does not invent a label the inputs do not fix.
 * - Whether a fiscal year has 52 or 53 weeks is derived from the gap between its own two
 *   ends, never assumed from a table.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Returns null on invalid input, including an unrecognised pattern or a `yearEndsOn` that
 *   is not a plain ISO date.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @param calendar { pattern: "4-5-4" | "4-4-5" | "5-4-4", yearEndsOn: ISO date stating the rule }
 * @returns { year, period, week }, or null on invalid input
 *
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // { year: 2024, period: 5, week: 19 }
 * @example getFiscalPeriod("2024-02-04", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // { year: 2024, period: 1, week: 1 } (NRF fiscal 2024 opens)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // { year: 2023, period: 12, week: 53 } (the 53rd week of NRF fiscal 2023)
 * @example getFiscalPeriod("2024-03-31", { pattern: "4-4-5", yearEndsOn: "2026-01-31" }) // { year: 2024, period: 3, week: 9 } (the same week, a period later than 4-5-4 puts it)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-5", yearEndsOn: "2026-01-31" }) // null (not one of the three patterns)
 * @example getFiscalPeriod("2024-06-15T12:00:00Z", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // null (a moment, not a calendar date)
 * @example getFiscalPeriod("invalid", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // null
 */
export function getFiscalPeriod(
  value: string,
  calendar: FiscalCalendar,
): { year: number; period: number; week: number } | null {
  const pattern = calendar?.pattern;
  const yearEndsOn = calendar?.yearEndsOn;

  if (!isFiscalPattern(pattern) || !isValidDate(yearEndsOn)) return null;

  const date = zonelessCalendarDate(value);
  if (!date) return null;

  try {
    const fiscalYear = fiscalYearOf(date, Temporal.PlainDate.from(yearEndsOn));
    if (!fiscalYear) return null;

    const { start, weeks } = fiscalYear;
    const week =
      Math.floor(
        start.until(date, { largestUnit: "day" }).days / DAYS_PER_WEEK,
      ) + 1;

    return {
      year: start.year,
      period: fiscalPeriodOfWeek(week, weeks, pattern),
      week,
    };
  } catch {
    return null;
  }
}
