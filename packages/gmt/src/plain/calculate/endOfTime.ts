import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidTime } from "../validate";

type EndOfTimeUnit = Temporal.TimeUnit | "day";

const supported: EndOfTimeUnit[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

/**
 * Return the end of the specified time `unit` (hour|minute|second|...) for a given ISO 8601 time string.
 * - Uses Temporal.PlainTime
 * - Returns an empty string "" for invalid inputs or units.
 *
 * @param value ISO 8601 time string
 * @param unit EndOfTimeUnit to specify the unit for the end (e.g. "hour")
 * @param options { fractionalSecondDigits?: number } - Optional parameter to specify fractionalSecondDigits for sub-second units (e.g. { fractionalSecondDigits: 3 } for milliseconds). Default is 0 for units larger than millisecond, 3 for millisecond, 6 for microsecond, and 9 for nanosecond.
 * @example endOfTime("12:34:56", "hour") => "12:59:59.999999999"
 * @returns ISO 8601 string representing the end of the specified unit, or empty string on invalid input
 */
export function endOfTime(
  value: string,
  unit: EndOfTimeUnit,
  optionsArg?: { fractionalSecondDigits?: FractionalDigit },
): string {
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

  if (!isValidTime(value) || !supported.includes(unit)) return "";

  const source = Temporal.PlainTime.from(value);
  let result: Temporal.PlainTime;

  switch (unit) {
    case "day":
      result = source.with({
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
