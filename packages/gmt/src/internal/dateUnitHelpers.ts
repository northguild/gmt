import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return the start of the specified date `unit` for a `Temporal.PlainDate`.
 *
 * - Always uses Monday as the week start (consistent with roundDate semantics).
 * - Does NOT validate the unit — caller ensures it is a DateUnit.
 *
 * @param source Temporal.PlainDate to round
 * @param unit DateUnit to specify the unit for the start
 * @returns Temporal.PlainDate at the start of the specified unit
 */
export function getStartOfDateUnit(
  source: Temporal.PlainDate,
  unit: string,
): Temporal.PlainDate {
  switch (unit) {
    case "year":
      return source.with({ month: 1, day: 1 });
    case "month":
      return source.with({ day: 1 });
    case "week": {
      const daysToSubtract = source.dayOfWeek - 1;
      return source.subtract({ days: daysToSubtract });
    }
    default:
      return source;
  }
}

/**
 * Add `amount` units of the specified date `unit` to a `Temporal.PlainDate`.
 *
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
      return date.add({ years: amount });
    case "month":
      return date.add({ months: amount });
    case "week":
      return date.add({ days: amount * 7 });
    default:
      return date.add({ days: amount });
  }
}
