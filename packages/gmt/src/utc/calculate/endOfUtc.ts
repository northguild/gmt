import { Temporal } from "@js-temporal/polyfill";

isValidUtc;

import type { FractionalDigit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

const supported: (Temporal.DateUnit | Temporal.TimeUnit)[] = [
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
 * Return the end of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Returns empty string for invalid inputs or units.
 *
 * @param value ISO UTC datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options weekStartsOn optional "monday" | "sunday", fractionalSecondDigits optional
 * @example endOfUtc("2024-03-15T14:30:45Z", "year") // "2024-12-31T23:59:59.999999999Z"
 * @example endOfUtc("2024-03-15T14:30:45Z", "month") // "2024-03-31T23:59:59.999999999Z"
 * @example endOfUtc("invalid", "year") // ""
 * @returns UTC Instant string representing the end of the unit, or "" on invalid input
 */
export function endOfUtc(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  const weekStartsOn = options?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = options?.fractionalSecondDigits;

  if (!isValidUtc(value) || !supported.includes(unit)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const source = instant.toZonedDateTimeISO("UTC");
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

    return result
      .toInstant()
      .toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
