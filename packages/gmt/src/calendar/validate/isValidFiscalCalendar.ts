import { isFiscalCalendarRecord } from "../../internal/unitNames";
import type { FiscalCalendar } from "../../types";

/**
 * Return true when `calendar` is a `FiscalCalendar` that `getFiscalPeriod` accepts.
 *
 * - `pattern` must be `"4-5-4"`, `"4-4-5"` or `"5-4-4"`.
 * - `yearEndsOn` must be a plain ISO date. A datetime or a date that does not exist is not.
 * - `extraWeek` must be `"firstPeriod"` or `"lastPeriod"`, and `yearLabel` must be
 *   `"startYear"`, `"endYear"` or `"majorityYear"`. Both are required: there is no default.
 * - Extra properties are ignored.
 * - Returns `false` for non-objects, `null` and arrays.
 * - `getFiscalPeriod` returns null for a calendar this rejects, the same sentinel it returns
 *   for an invalid date. Check the calendar here to tell the two apart.
 *
 * @param calendar candidate value of any type
 * @returns boolean indicating whether `getFiscalPeriod` accepts it
 *
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // true
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // false (the 1.19 shape: no extraWeek or yearLabel)
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-02-30", extraWeek: "lastPeriod", yearLabel: "startYear" }) // false
 * @example isValidFiscalCalendar("4-5-4") // false
 * @example isValidFiscalCalendar([]) // false
 */
export function isValidFiscalCalendar(
  calendar: unknown,
): calendar is FiscalCalendar {
  return isFiscalCalendarRecord(calendar);
}
