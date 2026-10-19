import { Temporal } from "./temporal";
import {
  businessDateFrom,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import type { RollConvention } from "../types";

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

/**
 * Move a date onto a working day according to `convention`, over an already-parsed calendar.
 * The core of `rollDate` and `cutoffAt`; neither calls the other.
 *
 * @param date the date to roll
 * @param convention the roll convention, already validated
 * @param calendar the parsed business calendar
 * @returns the rolled date, or `null` when the walk runs out
 *
 * @example rollBusinessDate(Temporal.PlainDate.from("2024-06-01"), "following", calendar) // 2024-06-03 (Saturday to Monday)
 */
export function rollBusinessDate(
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
