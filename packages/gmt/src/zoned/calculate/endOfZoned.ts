import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime, sets to end of unit, converts back to string.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns zoned ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-29T23:59:59.999999999+00:00[UTC]"
 * @example endOfZoned("invalid", "month") // ""
 */
export function endOfZoned(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

  if (!isValidZonedDateTime(value) || !isValidDateTimeUnit(unit)) return "";

  try {
    const source = Temporal.ZonedDateTime.from(value);
    let result: Temporal.ZonedDateTime;

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
          day: 1,
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
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        const endOfWeek = source
          .subtract({ days: daysToSubtract })
          .add({ days: 6 });
        result = endOfWeek.withPlainTime({
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
        result = source; // Smallest unit, nothing to set
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
    const fractionalDigits =
      fractionalSecondDigits ?? (precisionMap[unit] || 0);

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
