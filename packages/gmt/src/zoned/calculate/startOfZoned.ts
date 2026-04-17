import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../..";
import type { DateTimeUnit, FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to string.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the start
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns zoned ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-01T00:00:00+00:00[UTC]"
 * @example startOfZoned("invalid", "month") // ""
 */
export function startOfZoned(
  value: string,
  unit: DateTimeUnit,
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
        result = source.with({ month: 1, day: 1 }).withPlainTime();
        break;
      case "month":
        result = source.with({ day: 1 }).withPlainTime();
        break;
      case "week": {
        const daysToSubtract =
          weekStartsOn === "monday"
            ? source.dayOfWeek - 1
            : source.dayOfWeek % 7;
        result = source.subtract({ days: daysToSubtract }).withPlainTime();
        break;
      }
      case "day":
        result = source.withPlainTime();
        break;
      case "hour":
        result = source.with({
          minute: 0,
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "minute":
        result = source.with({
          second: 0,
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "second":
        result = source.with({ millisecond: 0, microsecond: 0, nanosecond: 0 });
        break;
      case "millisecond":
        result = source.with({ microsecond: 0, nanosecond: 0 });
        break;
      case "microsecond":
        result = source.with({ nanosecond: 0 });
        break;
      case "nanosecond":
        result = source; // Smallest unit, nothing to reset
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
