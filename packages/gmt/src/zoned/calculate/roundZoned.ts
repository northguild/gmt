// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  defaultFractionalDigits,
  isObject,
  resolveDateTimeUnit,
  roundZonedDateTime,
  zonedDateTimeFrom,
} from "../../internal";
import { isValidZonedDateTime } from "../validate";

const ZONED_ROUNDING_UNITS: readonly unknown[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

function isZonedRoundingUnit(unit: unknown): unit is "day" | Temporal.TimeUnit {
  return ZONED_ROUNDING_UNITS.includes(unit);
}

/**
 * Round an ISO 8601 zoned datetime string to the specified unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts "day" and time units: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Each unit is accepted in its singular or plural form ("day" or "days"), as Temporal's
 *   GetTemporalUnitValuedOption accepts both.
 * - Date units ("year", "month", "week") return "". This is the Temporal spec, not a polyfill
 *   limitation: `ZonedDateTime.prototype.round` accepts time units and "day" only
 *   (ValidateTemporalUnitValue with ~time~ and « day »).
 * - Wraps Temporal.ZonedDateTime.round() which throws on invalid options.
 * - Output precision follows `smallestUnit`: no fractional seconds for "day", "second" and
 *   coarser, 3 digits for "millisecond", 6 for "microsecond" and 9 for "nanosecond", so the
 *   result never hides the precision the unit asked for.
 * - Note: Temporal's `ZonedDateTime.prototype.round` takes no `disambiguation` or `offset` options.
 * - Follows TC39 `ZonedDateTime.round`, which rounds the wall clock and re-resolves it in the
 *   zone. Across a transition the result can land after the input or on another local date —
 *   `Pacific/Chatham` "2024-09-29T03:50:00+13:45" truncated to the hour gives 04:00+13:45, 15
 *   minutes later. Use `floorToZone` for a boundary that never exceeds the instant.
 *
 * @param value ISO 8601 zoned datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode
 * @returns Rounded ISO 8601 zoned datetime string, or "" on invalid input
 *
 * @example roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", { smallestUnit: "hour" }) // "2024-06-15T13:00:00-04:00[America/New_York]"
 * @example roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:30:00-04:00[America/New_York]"
 * @example roundZoned("2024-09-29T03:50:00+13:45[Pacific/Chatham]", { smallestUnit: "hour", roundingMode: "trunc" }) // "2024-09-29T04:00:00+13:45[Pacific/Chatham]" (after the input — TC39 wall-clock rounding)
 * @example roundZoned("2024-06-15T12:34:56-04:00[America/New_York]", { smallestUnit: "hours" }) // "2024-06-15T13:00:00-04:00[America/New_York]" (plural unit name)
 * @example roundZoned("2024-06-15T12:34:56.123456789-04:00[America/New_York]", { smallestUnit: "millisecond" }) // "2024-06-15T12:34:56.123-04:00[America/New_York]" (precision follows the unit)
 * @example roundZoned("invalid", { smallestUnit: "hour" }) // ""
 */
export function roundZoned(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  try {
    if (!isObject(options)) return "";

    const { roundingIncrement, roundingMode } = options;
    const smallestUnit: unknown =
      typeof options.smallestUnit === "string"
        ? resolveDateTimeUnit(options.smallestUnit)
        : options.smallestUnit;

    if (!isValidZonedDateTime(value)) return "";

    // Temporal ZonedDateTime.prototype.round: ValidateTemporalUnitValue(smallestUnit, ~time~, « day »)
    if (!isZonedRoundingUnit(smallestUnit)) return "";

    try {
      const source = zonedDateTimeFrom(value);
      const result = roundZonedDateTime(source, {
        smallestUnit,
        roundingIncrement,
        roundingMode,
      });

      const fractionalDigits = defaultFractionalDigits(smallestUnit);

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
