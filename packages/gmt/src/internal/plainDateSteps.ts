import { Temporal } from "./temporal";
import { isoDateLikeOf } from "./inputChecks";

/** The cores of the plain start-of, equality and week-start functions, so none calls another. */

/**
 * The first day of the `unit` a date falls in.
 *
 * - `week` starts on Monday or Sunday, as `weekStartsOn` says.
 * - May throw at the edge of the Temporal range; each caller turns that into its sentinel.
 *
 * @param date the date
 * @param unit `"year"`, `"month"`, `"week"` or `"day"`
 * @param weekStartsOn the first day of the week
 * @returns the start of the unit as a `PlainDate`
 *
 * @example startOfPlainDate(Temporal.PlainDate.from("2024-03-15"), "month", "monday").toString() // "2024-03-01"
 */
export function startOfPlainDate(
  date: Temporal.PlainDate,
  unit: Temporal.DateUnit,
  weekStartsOn: "monday" | "sunday",
): Temporal.PlainDate {
  switch (unit) {
    case "year":
      return date.with({ month: 1, day: 1 });
    case "month":
      return date.with({ day: 1 });
    case "week": {
      // Temporal numbers Monday 1 to Sunday 7.
      const daysToSubtract =
        weekStartsOn === "monday" ? date.dayOfWeek - 1 : date.dayOfWeek % 7;
      return date.subtract({ days: daysToSubtract });
    }
    default:
      return date;
  }
}

/**
 * The start of the `unit` a date-time falls in, with every finer field reset to zero.
 *
 * May throw at the edge of the Temporal range; each caller turns that into its sentinel.
 *
 * @param dateTime the date-time
 * @param unit any date or time unit
 * @param weekStartsOn the first day of the week
 * @returns the start of the unit as a `PlainDateTime`
 *
 * @example startOfPlainDateTime(Temporal.PlainDateTime.from("2024-03-15T10:30"), "hour", "monday").toString() // "2024-03-15T10:00:00"
 */
export function startOfPlainDateTime(
  dateTime: Temporal.PlainDateTime,
  unit: Temporal.DateTimeUnit,
  weekStartsOn: "monday" | "sunday",
): Temporal.PlainDateTime {
  switch (unit) {
    case "year":
      return dateTime.with({ month: 1, day: 1 }).withPlainTime();
    case "month":
      return dateTime.with({ day: 1 }).withPlainTime();
    case "week": {
      const daysToSubtract =
        weekStartsOn === "monday"
          ? dateTime.dayOfWeek - 1
          : dateTime.dayOfWeek % 7;
      return dateTime.subtract({ days: daysToSubtract }).withPlainTime();
    }
    case "day":
      return dateTime.withPlainTime();
    case "hour":
      return dateTime.with({
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
    case "minute":
      return dateTime.with({
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
    case "second":
      return dateTime.with({
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
    case "millisecond":
      return dateTime.with({ microsecond: 0, nanosecond: 0 });
    case "microsecond":
      return dateTime.with({ nanosecond: 0 });
    default:
      return dateTime;
  }
}

/**
 * Whether two strict ISO dates or date-times name the same calendar day.
 *
 * @param value1 the first candidate
 * @param value2 the second candidate
 * @returns `true` when both are valid and share year, month and day; `false` otherwise
 *
 * @example sameIsoDateLike("2024-03-15", "2024-03-15T10:00") // true
 * @example sameIsoDateLike("2024-03-15", "2024-03-16") // false
 */
export function sameIsoDateLike(value1: unknown, value2: unknown): boolean {
  if (!isoDateLikeOf(value1) || !isoDateLikeOf(value2)) {
    return false;
  }

  try {
    const date1 = Temporal.PlainDate.from(value1 as string);
    const date2 = Temporal.PlainDate.from(value2 as string);

    return (
      date1.year === date2.year &&
      date1.month === date2.month &&
      date1.day === date2.day
    );
  } catch {
    return false;
  }
}

/**
 * The first day of the week a date falls in, for a locale's first day of the week.
 *
 * @param date the date
 * @param firstDay the locale's first day, 1 (Monday) to 7 (Sunday)
 * @returns the first day of that week
 *
 * @example localeStartOfWeek(Temporal.PlainDate.from("2024-03-13"), 7).toString() // "2024-03-10"
 */
export function localeStartOfWeek(
  date: Temporal.PlainDate,
  firstDay: number,
): Temporal.PlainDate {
  const daysToSubtract = (date.dayOfWeek - firstDay + 7) % 7;
  return date.subtract({ days: daysToSubtract });
}

/**
 * Whether two dates fall in the same `unit`.
 *
 * May throw at the edge of the Temporal range; each caller turns that into `false`.
 *
 * @param date1 the first date
 * @param date2 the second date
 * @param unit `"year"`, `"month"`, `"week"` or `"day"`
 * @param weekStartsOn the first day of the week
 * @returns whether both dates share the start of the unit
 *
 * @example sameDateBy(Temporal.PlainDate.from("2024-03-01"), Temporal.PlainDate.from("2024-03-31"), "month", "monday") // true
 */
export function sameDateBy(
  date1: Temporal.PlainDate,
  date2: Temporal.PlainDate,
  unit: Temporal.DateUnit,
  weekStartsOn: "monday" | "sunday",
): boolean {
  if (unit === "day") {
    return (
      date1.year === date2.year &&
      date1.month === date2.month &&
      date1.day === date2.day
    );
  }
  return startOfPlainDate(date1, unit, weekStartsOn).equals(
    startOfPlainDate(date2, unit, weekStartsOn),
  );
}
