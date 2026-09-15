import { Temporal } from "@js-temporal/polyfill";
import { defaultFractionalDigits } from "../../internal";
import {
  addDateTimeUnit,
  getStartOfDateTimeUnit,
  getStartOfNextDateTimeUnit,
} from "../../internal/dateTimeUnitHelpers";
import { getDaysIntoDateUnit } from "../../internal/dateUnitHelpers";
import type { DateTimeUnit } from "../../types";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

const MILLISECONDS_PER_DAY = 86_400_000;

/** Milliseconds (with sub-millisecond fraction) from midnight to `source`'s wall-clock time. */
function millisecondsIntoDay(source: Temporal.PlainDateTime): number {
  return (
    source.hour * 3_600_000 +
    source.minute * 60_000 +
    source.second * 1_000 +
    source.millisecond +
    source.microsecond / 1_000 +
    source.nanosecond / 1_000_000
  );
}

/**
 * Round an ISO 8601 datetime string to the specified date-time unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts all date and time units: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Time units use Temporal.PlainDateTime.round() directly.
 * - Date units (year, month, week) use manual start-of-unit rounding. Weeks start on Monday.
 * - For date units the position within the unit is measured towards the next start, so a value in
 *   a unit that began before the first representable PlainDateTime
 *   (`-271821-04-19T00:00:00.000000001`) still rounds up to the next start. When it rounds down to
 *   that unrepresentable start, the result is "".
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO 8601 datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 datetime string, or "" on invalid input
 *
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "year" }) // "2024-01-01T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "month" }) // "2024-06-01T00:00:00" (under half way: rounds down)
 * @example roundDateTime("2024-06-16T12:34:56", { smallestUnit: "month" }) // "2024-07-01T00:00:00" (past half way: rounds up)
 * @example roundDateTime("-271821-04-19T12:00:00", { smallestUnit: "month" }) // "-271821-05-01T00:00:00" (the month began before the range)
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "day" }) // "2024-06-16T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hour" }) // "2024-06-15T13:00:00"
 * @example roundDateTime("invalid", { smallestUnit: "year" }) // ""
 */
export function roundDateTime(
  value: string,
  options: {
    smallestUnit: DateTimeUnit;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidDateTime(value) || !isValidDateTimeUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainDateTime.from(value);

    // PlainDateTime.round() in this polyfill supports day and time units
    const timeUnits: readonly string[] = [
      "day",
      "hour",
      "minute",
      "second",
      "millisecond",
      "microsecond",
      "nanosecond",
    ];

    if (timeUnits.includes(smallestUnit)) {
      const timeUnit = smallestUnit as Temporal.SmallestUnit<
        | "day"
        | "hour"
        | "minute"
        | "second"
        | "millisecond"
        | "microsecond"
        | "nanosecond"
      >;
      const result = source.round({
        smallestUnit: timeUnit,
        roundingIncrement,
        roundingMode,
      });

      const fractionalDigits = defaultFractionalDigits(smallestUnit);

      return result.toString({ fractionalSecondDigits: fractionalDigits });
    }

    // Manual rounding for date units (year, month, week)
    const increment = roundingIncrement ?? 1;
    if (increment <= 0) return "";

    // Measured towards the next start, never from the current one: the first representable
    // PlainDateTime is -271821-04-19T00:00:00.000000001, so the week, month and year holding it
    // began before the range, and only the next start exists. A PlainDateTime has no DST, so a day
    // is always 86,400,000 ms.
    const startOfNext = addDateTimeUnit(
      getStartOfNextDateTimeUnit(source, smallestUnit),
      smallestUnit,
      increment - 1,
    );
    const elapsedMs =
      getDaysIntoDateUnit(source, smallestUnit) * MILLISECONDS_PER_DAY +
      millisecondsIntoDay(source);
    const totalMs = elapsedMs + source.until(startOfNext).total("milliseconds");
    const fraction = elapsedMs / totalMs;

    // Only built when chosen; throws (so returns "") when it lies before the range.
    const startOfCurrent = (): Temporal.PlainDateTime =>
      getStartOfDateTimeUnit(source, smallestUnit);

    let rounded: Temporal.PlainDateTime;
    const mode = roundingMode ?? "halfExpand";
    switch (mode) {
      case "ceil":
      case "expand":
        rounded = elapsedMs > 0 ? startOfNext : startOfCurrent();
        break;
      case "floor":
      case "trunc":
        rounded = startOfCurrent();
        break;
      case "halfExpand":
      case "halfCeil":
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent();
        break;
      case "halfTrunc":
      case "halfFloor":
        rounded = fraction > 0.5 ? startOfNext : startOfCurrent();
        break;
      case "halfEven":
        // Simplified: use halfExpand behavior
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent();
        break;
      default:
        rounded = startOfCurrent();
    }

    return rounded.toString();
  } catch {
    return "";
  }
}
