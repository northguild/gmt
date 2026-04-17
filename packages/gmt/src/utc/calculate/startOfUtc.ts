import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { isValidUtc } from "../validate";

/**
 * Return the start of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to Instant.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns UTC Instant string representing the start of the unit, or "" on invalid input
 *
 * @example startOfUtc("2024-03-15T14:30:45Z", "year") // "2024-01-01T00:00:00Z"
 * @example startOfUtc("2024-03-15T14:30:45Z", "month") // "2024-03-01T00:00:00Z"
 * @example startOfUtc("invalid", "year") // ""
 */
export function startOfUtc(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  const weekStartsOn = options?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = options?.fractionalSecondDigits;

  if (!isValidUtc(value) || !isValidDateTimeUnit(unit)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const source = instant.toZonedDateTimeISO("UTC");
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
        result = source.with({
          millisecond: 0,
          microsecond: 0,
          nanosecond: 0,
        });
        break;
      case "millisecond":
        result = source.with({ microsecond: 0, nanosecond: 0 });
        break;
      case "microsecond":
        result = source.with({ nanosecond: 0 });
        break;
      case "nanosecond":
        result = source;
        break;
      default:
        return "";
    }

    const precisionMap: Record<string, FractionalDigit> = {
      millisecond: 3,
      microsecond: 6,
      nanosecond: 9,
    };
    const fractionalDigits =
      fractionalSecondDigits ?? (precisionMap[unit] || 0);

    return result.toInstant().toString({
      fractionalSecondDigits: fractionalDigits,
    });
  } catch {
    return "";
  }
}
