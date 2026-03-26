import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";

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
 * Return the start of the specified date-time `unit` (year|month|day|hour|minute|...)
 * for a given zoned ISO 8601 datetime string.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the start (e.g. "month")
 * @param options { weekStartsOn: "monday" | "sunday" = 'monday', fractionalSecondDigits?: number } - Optional parameter to specify the start of the week when unit is "week". Default is "monday". Optional parameter to specify fractionalSecondDigits for sub-second units (e.g. { fractionalSecondDigits: 3 } for milliseconds). Default is 0 for units larger than millisecond, 3 for millisecond, 6 for microsecond, and 9 for nanosecond.
 * @example startOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") => "2024-02-01T00:00:00+00:00[UTC]"
 * @returns zoned ISO 8601 string representing the start of the specified unit, or empty string on invalid input
 */
export function startOfZoned(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

  if (!isValidZonedDateTime(value) || !supported.includes(unit)) return "";

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
        weekStartsOn === "monday" ? source.dayOfWeek - 1 : source.dayOfWeek % 7;
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
  const fractionalDigits = fractionalSecondDigits ?? (precisionMap[unit] || 0);

  return result.toString({ fractionalSecondDigits: fractionalDigits });
}
