import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidDateTime } from "../validate";

const supported = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

/**
 * Return the end of the specified date-time `unit` (year|month|day|hour|minute|...)
 * for a given ISO 8601 datetime string.
 * - Uses Temporal.PlainDateTime
 * - Returns an empty string "" for invalid inputs or units.
 *
 * @param value ISO 8601 datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the unit for the end (e.g. "month")
 * @param options { weekStartsOn: "monday" | "sunday", fractionalSecondDigits?: number } - Optional parameter to specify the start of the week when unit is "week". Default is "monday". Optional parameter to specify fractionalSecondDigits for sub-second units (e.g. { fractionalSecondDigits: 3 } for milliseconds). Default is 0 for units larger than millisecond, 3 for millisecond, 6 for microsecond, and 9 for nanosecond.
 * @example endOfDateTime("2024-02-29T12:34:56", "month") => "2024-02-29T23:59:59.999999999"
 * @returns ISO 8601 string representing the end of the specified unit, or empty string on invalid input
 */
export function endOfDateTime(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

  if (!isValidDateTime(value) || !supported.includes(unit)) return "";

  const source = Temporal.PlainDateTime.from(value);
  let result: Temporal.PlainDateTime;

  switch (unit) {
    case "year":
      result = source.with({ month: 12, day: 31 }).withPlainTime({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    case "month": {
      const lastDay = Temporal.PlainDate.from({
        year: source.year,
        month: source.month,
        day: 1, // Start from day 1 to get daysInMonth
      }).daysInMonth;
      result = source.with({ day: lastDay }).withPlainTime({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    }
    case "week": {
      const daysToAdd =
        weekStartsOn === "monday"
          ? 7 - source.dayOfWeek
          : (6 - source.dayOfWeek) % 7;
      result = source
        .with({
          year: source.year,
          month: source.month,
          day: source.day,
        })
        .add({ days: daysToAdd })
        .withPlainTime({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
          microsecond: 999,
          nanosecond: 999,
        });
      break;
    }
    case "day":
      result = source.withPlainTime({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    case "hour":
      result = source.with({
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    case "minute":
      result = source.with({
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    case "second":
      result = source.with({
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      });
      break;
    case "millisecond":
      result = source.with({ microsecond: 999, nanosecond: 999 });
      break;
    case "microsecond":
      result = source.with({ nanosecond: 999 });
      break;
    case "nanosecond":
      result = source;
      break;
    default:
      return "";
  }

  // Handle default precision: 0 for > sec, 3 for ms, 6 for µs, 9 for ns
  const precisionMap: Record<string, FractionalDigit> = {
    millisecond: 3,
    microsecond: 6,
    nanosecond: 9,
  };
  const fractionalDigits = fractionalSecondDigits ?? (precisionMap[unit] || 0);

  return result.toString({
    fractionalSecondDigits: fractionalDigits,
  });
}
