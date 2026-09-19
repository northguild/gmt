import { parseBusinessCalendar } from "../../internal/businessCalendar";
import type { BusinessCalendar } from "../../types";

/**
 * Return true when `calendar` is a `BusinessCalendar` the business-day functions accept.
 *
 * - `weekend` must be an array of ISO weekday integers, 1 (Monday) through 7 (Sunday).
 *   Duplicates are ignored and `[]` is valid — a calendar with no weekly closure.
 * - All seven weekdays being weekend is **invalid**: such a calendar has no business day, so
 *   `nextBusinessDay` and every other walk would have nothing to walk to.
 * - `holidays` must be an array of ISO PlainDate strings. `[]` is valid. A datetime, a leap
 *   second or a date that does not exist is not.
 * - `timeZone` must be a valid IANA identifier. It records which locality the calendar
 *   describes; the business-day functions never read it, because they work on local dates.
 * - Returns `false` for non-objects, `null` and arrays.
 * - Use it to tell a legitimate result from `mergeCalendars` apart from its invalid-input
 *   sentinel, which is also `null`, and to tell a misconfigured calendar apart from a bad date
 *   when a business-day function returns `""`.
 *
 * @param calendar candidate value of any type
 * @returns boolean indicating whether every business-day function accepts it
 *
 * @example isValidBusinessCalendar({ weekend: [6, 7], holidays: [], timeZone: "UTC" }) // true
 * @example isValidBusinessCalendar({ weekend: [5, 6], holidays: ["2024-07-04"], timeZone: "Asia/Riyadh" }) // true — Friday–Saturday
 * @example isValidBusinessCalendar({ weekend: [], holidays: [], timeZone: "UTC" }) // true — no weekly closure
 * @example isValidBusinessCalendar({ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }) // false — no business day left
 * @example isValidBusinessCalendar({ weekend: [6, 8], holidays: [], timeZone: "UTC" }) // false — 8 is not an ISO weekday
 * @example isValidBusinessCalendar({ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }) // false — that date does not exist
 * @example isValidBusinessCalendar({ weekend: [6, 7], holidays: ["2024-07-04T00:00:00"], timeZone: "UTC" }) // false — a datetime, not a date
 * @example isValidBusinessCalendar({ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }) // false
 * @example isValidBusinessCalendar(null) // false
 */
export function isValidBusinessCalendar(
  calendar: unknown,
): calendar is BusinessCalendar {
  return parseBusinessCalendar(calendar) !== null;
}
