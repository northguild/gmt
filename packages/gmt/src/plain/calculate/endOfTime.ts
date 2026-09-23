// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import type { FractionalDigit } from "../../types";
import { isValidTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Units `endOfTime` accepts: a Temporal time unit, or `"day"` for the last moment of the day, each singular
 * or plural.
 *
 * @example
 * import { EndOfTimeUnit } from "@northguild/gmt/plain";
 * const unit: EndOfTimeUnit = "minutes";
 */
export type EndOfTimeUnit = Temporal.SmallestUnit<Temporal.TimeUnit | "day">;

const supported: readonly string[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

/**
 * Return the end of the specified time `unit` for a given ISO 8601 time string.
 *
 * - The end is written at nanosecond precision by default, so the string names the end itself; an explicit `fractionalSecondDigits` (0, 3, 6 or 9) truncates it, as Temporal's `toString` does.
 * - `unit` accepts the singular or plural name (`"hour"` or `"hours"`), as Temporal does.
 * - Returns "" for invalid inputs.
 * - **Compatibility:** before 1.16.0 the default printed only the digits the unit names — none for
 *   `second` and coarser, 3 for `millisecond`, 6 for `microsecond` — which wrote a moment earlier
 *   than the end. Pass that `fractionalSecondDigits` to keep the previous string.
 *
 * @param value ISO 8601 time string
 * @param unit EndOfTimeUnit to specify the unit for the end
 * @param optionsArg optional: fractionalSecondDigits (number)
 * @returns ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfTime("12:34:56", "hour") // "12:59:59.999999999"
 * @example endOfTime("12:34:56", "hour", { fractionalSecondDigits: 0 }) // "12:59:59" — the pre-1.16.0 string
 * @example endOfTime("12:34:56.123", "milliseconds") // "12:34:56.123999999"
 * @example endOfTime("invalid", "hour") // ""
 */
export function endOfTime(
  value: string,
  unit: EndOfTimeUnit,
  optionsArg?: { fractionalSecondDigits?: FractionalDigit },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

    const resolvedUnit = resolveDateTimeUnit(unit);

    if (!isValidTime(value) || !supported.includes(resolvedUnit)) return "";

    try {
      const source = Temporal.PlainTime.from(value);
      let result: Temporal.PlainTime;

      switch (resolvedUnit) {
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

      // An end is the next start − 1 ns, so it defaults to nanosecond precision: fewer digits would
      // print an earlier value than the end (Calendar & zone semantics §3).
      return result.toString({
        fractionalSecondDigits:
          fractionalSecondDigits === undefined ? 9 : fractionalSecondDigits,
      });
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
