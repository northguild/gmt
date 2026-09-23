import { Temporal } from "@js-temporal/polyfill";
import {
  businessDateFrom,
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "../../internal/businessCalendar";
import { isValidDate } from "../../plain/validate";
import type { BusinessCalendar, RollConvention } from "../../types";
import { isValidRollConvention } from "../validate";

function sameMonth(a: Temporal.PlainDate, b: Temporal.PlainDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Roll in `direction`, and if that leaves the date's month, roll the other way instead.
 */
function modifiedRoll(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  const rolled = businessDateFrom(date, direction, calendar);

  // An exhausted walk is a sentinel, not a "left the month" answer: turning round here would
  // report the opposite direction's date as though the first walk had succeeded.
  if (rolled === null) {
    return null;
  }

  return sameMonth(rolled, date)
    ? rolled
    : businessDateFrom(date, direction === 1 ? -1 : 1, calendar);
}

function rollTo(
  date: Temporal.PlainDate,
  convention: RollConvention,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  switch (convention) {
    case "following":
      return businessDateFrom(date, 1, calendar);
    case "preceding":
      return businessDateFrom(date, -1, calendar);
    case "modifiedFollowing":
      return modifiedRoll(date, 1, calendar);
    case "modifiedPreceding":
      return modifiedRoll(date, -1, calendar);
    case "endOfMonth":
      return businessDateFrom(
        date.with({ day: date.daysInMonth }),
        -1,
        calendar,
      );
    case "none":
      return date;
  }
}

/**
 * Move a local date onto a working day according to `convention`.
 *
 * Every industry answers "what if it lands on a non-working day" differently, so the
 * convention is always explicit — there is no default.
 *
 * | Convention | Behaviour |
 * | --- | --- |
 * | `following` | Forward to the next working day; a working day is left alone |
 * | `modifiedFollowing` | Forward, unless that crosses into the next month, then backward |
 * | `preceding` | Backward to the previous working day; a working day is left alone |
 * | `modifiedPreceding` | Backward, unless that crosses into the previous month, then forward |
 * | `endOfMonth` | The last working day of `value`'s own month, wherever in the month it falls |
 * | `none` | Return `value` unadjusted, working day or not |
 *
 * - `following` and `preceding` are **on or after** and **on or before**: they return `value`
 *   itself when it is already a working day. For the strict neighbours use `nextBusinessDay`
 *   and `previousBusinessDay`.
 * - `following`, `modifiedFollowing` and `preceding` are the three conventions
 *   [ISDA 2006 Definitions §4.12(a)](https://www.isda.org/a/smMDE/Blackline-2000-v-2006-ISDA-Definitions.pdf) defines, in
 *   (i)–(iii), and match that text: (iii) reads "if 'Preceding' is specified, that date will be
 *   the first preceding day that is a Business Day". §4.12(a) has no Modified Preceding;
 *   `modifiedPreceding` follows FpML's `BusinessDayConventionEnum` `MODPRECEDING`: "adjusted
 *   to the first preceding day that is a business day unless that day falls in the previous
 *   calendar month, in which case … the first following day". `none` is what
 *   [OpenGamma Strata](https://strata.opengamma.io/apidocs/com/opengamma/strata/basics/date/BusinessDayConventions.html)
 *   calls `NO_ADJUST`. No TC39, ECMA or RFC standard governs them.
 * - `endOfMonth` is **not** an ISDA business-day convention, and not the industry "EOM rule",
 *   which is a *schedule* rule: hold every date in a schedule to its month's last day once
 *   the anchor is one. It is GMT's primitive for building that rule. It always snaps to the
 *   last working day on or before the month's final day, even from mid-month — leaving the
 *   month only if that whole month is closed, as a works shutdown would make it. A forward
 *   from a month-end anchor settles on the last working day of the *target* month, so the
 *   caller tests the anchor for month-end and applies this to the unadjusted target. Applied
 *   to a month-end date it agrees with `modifiedFollowing`.
 * - `value` and `calendar.holidays` are local dates; `calendar.timeZone` is not read. A caller
 *   holding an instant reduces it to a local date first, with `floorToZone`.
 * - Returns `""` when `value` is not a valid ISO PlainDate, when `convention` is not one GMT
 *   implements, when `calendar` is not a valid `BusinessCalendar`, and when the walk runs past
 *   200,000 calendar days without finding a working day. Narrow the convention with
 *   `isValidRollConvention` to tell a misconfigured contract term apart from a bad date.
 *
 * @param value ISO PlainDate string to roll
 * @param convention RollConvention to apply
 * @param calendar BusinessCalendar naming the weekend days and holidays
 * @returns ISO PlainDate string of the rolled date, or "" on invalid input
 *
 * @example rollDate("2024-05-31", "following", { weekend: [6, 7], holidays: ["2024-05-31"], timeZone: "America/New_York" }) // "2024-06-03"
 * @example rollDate("2024-05-31", "modifiedFollowing", { weekend: [6, 7], holidays: ["2024-05-31"], timeZone: "America/New_York" }) // "2024-05-30" — forward would leave May
 * @example rollDate("2024-06-01", "modifiedPreceding", { weekend: [6, 7], holidays: ["2024-05-31"], timeZone: "America/New_York" }) // "2024-06-03" — backward would leave June
 * @example rollDate("2024-05-29", "following", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "2024-05-29" — already a working day
 * @example rollDate("2024-03-15", "endOfMonth", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "2024-03-29" — March ends on a Sunday
 * @example rollDate("2024-06-01", "none", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "2024-06-01" — a Saturday, unadjusted
 * @example rollDate("2024-07-05", "following", { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" }) // "2024-07-07" — Friday–Saturday weekend
 * @example rollDate("2024-05-31", "nearest", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // "" — not a convention GMT implements
 * @example rollDate("invalid", "following", { weekend: [6, 7], holidays: [], timeZone: "UTC" }) // ""
 */
export function rollDate(
  value: string,
  convention: RollConvention,
  calendar: BusinessCalendar,
): string {
  try {
    const resolved = parseBusinessCalendar(calendar);

    if (
      !isValidDate(value) ||
      !isValidRollConvention(convention) ||
      resolved === null
    ) {
      return "";
    }

    try {
      const rolled = rollTo(Temporal.PlainDate.from(value), convention, resolved);

      return rolled === null ? "" : rolled.toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
