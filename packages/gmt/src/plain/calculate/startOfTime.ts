// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { defaultFractionalDigits } from "../../internal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import type { FractionalDigit } from "../../types";
import { isValidTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Units `startOfTime` accepts: a Temporal time unit, or `"day"` for midnight, each singular or plural.
 *
 * @example
 * import { StartOfTimeUnit } from "@northguild/gmt/plain";
 * const unit: StartOfTimeUnit = "hours";
 */
export type StartOfTimeUnit = Temporal.SmallestUnit<Temporal.TimeUnit | "day">;

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
 * Return the start of the specified time `unit` for a given ISO 8601 time string.
 *
 * - The start keeps every field larger than `unit` and zeroes every smaller one, down to the
 *   nanosecond: `"millisecond"` keeps the milliseconds, `"day"` is midnight.
 * - `unit` accepts the singular or plural name (`"hour"` or `"hours"`), as Temporal does.
 * - Returns "" for invalid inputs.
 * - **Compatibility:** before 1.16.0 the sub-second units zeroed their own field (`"millisecond"`
 *   on `12:34:56.999` gave `12:34:56.000`), and `"day"`/`"hour"`/`"minute"` kept the fraction.
 *
 * @param value ISO 8601 time string
 * @param unit StartOfTimeUnit to specify the unit for the start
 * @param optionsArg optional: fractionalSecondDigits (number)
 * @returns ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfTime("12:34:56", "hour") // "12:00:00"
 * @example startOfTime("12:34:56.999", "millisecond") // "12:34:56.999"
 * @example startOfTime("12:34:56.123456789", "minutes", { fractionalSecondDigits: 9 }) // "12:34:00.000000000"
 * @example startOfTime("invalid", "hour") // ""
 */
export function startOfTime(
  value: string,
  unit: StartOfTimeUnit,
  optionsArg?: { fractionalSecondDigits?: FractionalDigit },
): string {
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }

  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;
  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidTime(value) || !supported.includes(resolvedUnit)) return "";

  try {
    const source = Temporal.PlainTime.from(value);
    const result =
      resolvedUnit === "day"
        ? new Temporal.PlainTime()
        : source.round({
            smallestUnit: resolvedUnit as Temporal.TimeUnit,
            roundingMode: "floor",
          });

    const fractionalDigits = defaultFractionalDigits(
      resolvedUnit,
      fractionalSecondDigits,
    );

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
