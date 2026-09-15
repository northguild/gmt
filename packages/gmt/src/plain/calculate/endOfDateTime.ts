import { Temporal } from "@js-temporal/polyfill";
import { defaultFractionalDigits } from "../../internal";
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
 * Return the end of the specified date-time `unit` for a given ISO 8601 datetime string.
 *
 * - A Sunday-first week runs Sunday to Saturday, so a Sunday ends its week six days later.
 * - The end is computed forward from `value`, so it is returned even when the unit began before
 *   the first representable date (`-271821-04-19`).
 * - `fractionalSecondDigits` defaults to 3, 6 or 9 for "millisecond", "microsecond" or
 *   "nanosecond", and 0 otherwise.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the unit for the end
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfDateTime("2024-02-29T12:34:56", "month") // "2024-02-29T23:59:59"
 * @example endOfDateTime("2024-02-29T12:34:56.123456789", "second", { fractionalSecondDigits: 9 }) // "2024-02-29T12:34:56.999999999"
 * @example endOfDateTime("2024-03-03T12:00:00", "week", { weekStartsOn: "sunday" }) // "2024-03-09T23:59:59"
 * @example endOfDateTime("-271821-04-19T12:00:00", "month") // "-271821-04-30T23:59:59" (the month began before the range; its end did not)
 * @example endOfDateTime("invalid-date", "month") // ""
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

  try {
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
        // Computed from `value` itself: the month's first day may lie before the range.
        result = source.with({ day: source.daysInMonth }).withPlainTime({
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
        // Sunday is day 7, so `dayOfWeek % 7` counts Sunday as day 0 of a Sunday-first week.
        const daysToAdd =
          weekStartsOn === "monday"
            ? 7 - source.dayOfWeek
            : 6 - (source.dayOfWeek % 7);
        result = source.add({ days: daysToAdd }).withPlainTime({
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

    const fractionalDigits = defaultFractionalDigits(
      unit,
      fractionalSecondDigits,
    );

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
