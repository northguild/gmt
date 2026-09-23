// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { defaultFractionalDigits } from "../../internal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import type { FractionalDigit } from "../../types";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the specified date-time `unit` for a given ISO 8601 datetime string.
 *
 * - `unit` accepts the singular or plural name (`"month"` or `"months"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid inputs.
 *
 * @param value ISO 8601 datetime string
 * @param unit date or time unit, singular or plural, to specify the unit for the start
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfDateTime("2024-02-29T12:34:56", "month") // "2024-02-01T00:00:00"
 * @example startOfDateTime("2024-02-29T12:34:56.789", "milliseconds") // "2024-02-29T12:34:56.789"
 * @example startOfDateTime("invalid-datetime", "month") // ""
 */
export function startOfDateTime(
  value: string,
  unit: Temporal.SmallestUnit<Temporal.DateTimeUnit>,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
    const fractionalSecondDigits = optionsArg?.fractionalSecondDigits;

    const resolvedUnit = resolveDateTimeUnit(unit);

    if (
      weekStartsOn === null ||
      !isValidDateTime(value) ||
      !isValidDateTimeUnit(resolvedUnit)
    )
      return "";

    try {
      const source = Temporal.PlainDateTime.from(value);
      let result: Temporal.PlainDateTime;

      switch (resolvedUnit) {
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

      const fractionalDigits = defaultFractionalDigits(
        resolvedUnit,
        fractionalSecondDigits,
      );

      return result.toString({ fractionalSecondDigits: fractionalDigits });
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
