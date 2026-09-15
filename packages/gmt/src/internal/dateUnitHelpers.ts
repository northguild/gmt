import type { Temporal } from "@js-temporal/polyfill";
import {
  calendarDateAdd,
  calendarDateFromFields,
  calendarFieldsOf,
} from "./temporalCompat";

/**
 * Day 1 of `source`'s month, or of month 1 of its year when `month` is 1, in `source`'s calendar.
 * Non-ISO calendars build it from corrected reads through the Temporal compat layer (CORE-6: the
 * polyfill's `with` is wrong or throws where its fields → ISO conversion is).
 */
function startOfCalendarPeriod(
  source: Temporal.PlainDate,
  month?: 1,
): Temporal.PlainDate {
  if (source.calendarId === "iso8601") {
    return source.with(month === undefined ? { day: 1 } : { month, day: 1 });
  }
  const fields = calendarFieldsOf(source, source.calendarId);
  return calendarDateFromFields(
    source.calendarId,
    { year: fields.year, month: month ?? fields.month, day: 1 },
    "reject",
  );
}

/**
 * Return the start of the specified date `unit` for a `Temporal.PlainDate`.
 *
 * - Always uses Monday as the week start (consistent with roundDate semantics).
 * - Works in `source`'s own calendar (a Hebrew month starts on its day 1).
 * - Does NOT validate the unit — caller ensures it is a DateUnit.
 *
 * @param source Temporal.PlainDate to round
 * @param unit DateUnit to specify the unit for the start
 * @returns Temporal.PlainDate at the start of the specified unit; throws RangeError when it lies
 *   before the representable range
 */
export function getStartOfDateUnit(
  source: Temporal.PlainDate,
  unit: string,
): Temporal.PlainDate {
  switch (unit) {
    case "year":
      return startOfCalendarPeriod(source, 1);
    case "month":
      return startOfCalendarPeriod(source);
    case "week":
      return calendarDateAdd(
        source,
        { days: 1 - source.dayOfWeek },
        "constrain",
      );
    default:
      return source;
  }
}

/**
 * Add `amount` units of the specified date `unit` to a `Temporal.PlainDate`.
 *
 * - Calendar units resolve in `source`'s calendar through the Temporal compat layer.
 * - Does NOT validate the unit — caller ensures it is a DateUnit.
 *
 * @param date Temporal.PlainDate to advance
 * @param unit DateUnit to add
 * @param amount number of units to add
 * @returns new Temporal.PlainDate advanced by the specified amount
 */
export function addDateUnit(
  date: Temporal.PlainDate,
  unit: string,
  amount: number,
): Temporal.PlainDate {
  switch (unit) {
    case "year":
      return calendarDateAdd(date, { years: amount }, "constrain");
    case "month":
      return calendarDateAdd(date, { months: amount }, "constrain");
    case "week":
      return calendarDateAdd(date, { days: amount * 7 }, "constrain");
    default:
      return calendarDateAdd(date, { days: amount }, "constrain");
  }
}

/**
 * Return the start of the date `unit` after the one containing `source`.
 *
 * - Steps one unit first and truncates after, so `source`'s own start is never materialised: the
 *   month holding the first representable date (`-271821-04-19`) began before the range, while the
 *   next month's start did not. Both orders agree everywhere else, because a one-unit step clamps
 *   within the next unit (Jan 31 + 1 month = Feb 29, whose month starts on Feb 1).
 * - Always uses Monday as the week start, like `getStartOfDateUnit`.
 * - Does NOT validate the unit — caller ensures it is a DateUnit.
 *
 * @param source Temporal.PlainDate inside the current unit
 * @param unit DateUnit to step by
 * @returns Temporal.PlainDate at the start of the next unit
 *
 * @example getStartOfNextDateUnit(Temporal.PlainDate.from("2024-01-31"), "month") // 2024-02-01
 * @example getStartOfNextDateUnit(Temporal.PlainDate.from("-271821-04-19"), "month") // -271821-05-01
 */
export function getStartOfNextDateUnit(
  source: Temporal.PlainDate,
  unit: string,
): Temporal.PlainDate {
  return getStartOfDateUnit(addDateUnit(source, unit, 1), unit);
}

/**
 * Return the whole days from the start of the date `unit` containing `source` to `source`.
 *
 * - Read from the calendar fields, so the unit's start is never materialised (it may lie before
 *   the representable range).
 * - Always uses Monday as the week start, like `getStartOfDateUnit`. A day unit is 0 days in.
 * - Accepts a `Temporal.PlainDate` or a `Temporal.PlainDateTime` (only its date matters).
 * - Does NOT validate the unit — caller ensures it is a DateUnit.
 *
 * @param source value with ISO calendar date fields
 * @param unit DateUnit to measure within
 * @returns number of whole days since the unit started
 *
 * @example getDaysIntoDateUnit(Temporal.PlainDate.from("2024-03-13"), "month") // 12
 * @example getDaysIntoDateUnit(Temporal.PlainDate.from("2024-03-13"), "week") // 2 (a Wednesday)
 */
export function getDaysIntoDateUnit(
  source: Pick<Temporal.PlainDate, "day" | "dayOfWeek" | "dayOfYear">,
  unit: string,
): number {
  switch (unit) {
    case "year":
      return source.dayOfYear - 1;
    case "month":
      return source.day - 1;
    case "week":
      return source.dayOfWeek - 1;
    default:
      return 0;
  }
}
