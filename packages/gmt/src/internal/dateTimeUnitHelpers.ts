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
