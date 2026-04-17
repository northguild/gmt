import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidTime } from "../validate";

type StartOfTimeUnit = Temporal.TimeUnit | "day";

const supported: StartOfTimeUnit[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

/**
 * Return the start of the specified time `unit` for a given ISO 8601 time string.
 *
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 time string
 * @param unit StartOfTimeUnit to specify the unit for the start
 * @param optionsArg optional: fractionalSecondDigits (number)
 * @returns ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfTime("12:34:56", "hour") // "12:00:00"
 * @example startOfTime("invalid", "hour") // ""
 */
export function startOfTime(
  value: string,
  unit: StartOfTimeUnit,
  optionsArg?: { fractionalSecondDigits?: FractionalDigit },
): string {
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;
  if (!isValidTime(value) || !supported.includes(unit)) return "";

  try {
    const source = Temporal.PlainTime.from(value);
    let result: Temporal.PlainTime;

    switch (unit) {
      case "day":
        result = source.with({ hour: 0, minute: 0, second: 0 });
        break;
      case "hour":
        result = source.with({ minute: 0, second: 0 });
        break;
      case "minute":
        result = source.with({ second: 0 });
        break;
      case "second":
        result = source.with({ millisecond: 0, microsecond: 0, nanosecond: 0 });
        break;
      case "millisecond":
        result = source.with({ millisecond: 0, microsecond: 0, nanosecond: 0 });
        break;
      case "microsecond":
        result = source.with({ microsecond: 0, nanosecond: 0 });
        break;
      case "nanosecond":
        result = source.with({ nanosecond: 0 });
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

    return result.toString({
      fractionalSecondDigits: fractionalDigits,
    });
  } catch {
    return "";
  }
}
