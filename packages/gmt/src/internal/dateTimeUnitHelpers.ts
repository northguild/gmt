import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return the start of the specified date-time `unit` for a `Temporal.PlainDateTime`.
 *
 * - Always uses Monday as the week start (consistent with roundDateTime semantics).
 * - Date units (year, month, week) reset the time to midnight.
 * - Does NOT validate the unit — caller ensures it is a DateTimeUnit.
 *
 * @param source Temporal.PlainDateTime to round
 * @param unit DateTimeUnit to specify the unit for the start
 * @returns Temporal.PlainDateTime at the start of the specified unit
 */
export function getStartOfDateTimeUnit(
  source: Temporal.PlainDateTime,
  unit: string,
): Temporal.PlainDateTime {
  switch (unit) {
    case "year":
      return source.with({ month: 1, day: 1 }).withPlainTime();
    case "month":
      return source.with({ day: 1 }).withPlainTime();
    case "week": {
      const daysToSubtract = source.dayOfWeek - 1;
      return source.subtract({ days: daysToSubtract }).withPlainTime();
    }
    default:
      return source.withPlainTime();
  }
}

/**
 * Add `amount` units of the specified date-time `unit` to a `Temporal.PlainDateTime`.
 *
 * - Only year, month, and week are meaningful for the manual rounding path.
 * - Day and time units return the input unchanged (they are handled by
 *   `Temporal.PlainDateTime.round()` in the callers).
 * - Does NOT validate the unit — caller ensures it is a DateTimeUnit.
 *
 * @param date Temporal.PlainDateTime to advance
 * @param unit DateTimeUnit to add
 * @param amount number of units to add
 * @returns new Temporal.PlainDateTime advanced by the specified amount
 */
export function addDateTimeUnit(
  date: Temporal.PlainDateTime,
  unit: string,
  amount: number,
): Temporal.PlainDateTime {
  switch (unit) {
    case "year":
      return date.add({ years: amount });
    case "month":
      return date.add({ months: amount });
    case "week":
      return date.add({ days: amount * 7 });
    default:
      return date;
  }
}

/**
 * Return the start of the date `unit` after the one containing `source`.
 *
 * - Steps one unit first and truncates after, so `source`'s own start is never materialised: the
 *   first representable PlainDateTime is `-271821-04-19T00:00:00.000000001`, so even the day
 *   holding it began before the range, while the next day's midnight did not.
 * - Year, month and week step by that unit (weeks start on Monday, like `getStartOfDateTimeUnit`);
 *   every other unit steps to the next midnight, matching `getStartOfDateTimeUnit`'s day default.
 * - Does NOT validate the unit — caller ensures it is a DateTimeUnit.
 *
 * @param source Temporal.PlainDateTime inside the current unit
 * @param unit DateTimeUnit to step by
 * @returns Temporal.PlainDateTime at the start of the next unit
 *
 * @example getStartOfNextDateTimeUnit(Temporal.PlainDateTime.from("2024-03-15T14:30:45"), "week") // 2024-03-18T00:00:00
 * @example getStartOfNextDateTimeUnit(Temporal.PlainDateTime.from("-271821-04-19T12:00:00"), "day") // -271821-04-20T00:00:00
 */
export function getStartOfNextDateTimeUnit(
  source: Temporal.PlainDateTime,
  unit: string,
): Temporal.PlainDateTime {
  switch (unit) {
    case "year":
    case "month":
    case "week":
      return getStartOfDateTimeUnit(addDateTimeUnit(source, unit, 1), unit);
    default:
      return source.add({ days: 1 }).withPlainTime();
  }
}
