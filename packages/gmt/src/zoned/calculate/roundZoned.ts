import { Temporal } from "@js-temporal/polyfill";
import {
  defaultFractionalDigits,
  roundZonedDateTime,
  zonedDateTimeFrom,
} from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Round an ISO 8601 zoned datetime string to the specified unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts "day" and time units: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Date units ("year", "month", "week") are not supported by the Temporal polyfill's ZonedDateTime.round() — they return "".
 * - Wraps Temporal.ZonedDateTime.round() which throws on invalid options.
 * - Note: The polyfill's `.round()` does not support `disambiguation` or `offset` options.
 * - Follows TC39 `ZonedDateTime.round`, which rounds the wall clock and re-resolves it in the
 *   zone. Across a transition the result can land after the input or on another local date —
 *   `Pacific/Chatham` "2024-09-29T03:50:00+13:45" truncated to the hour gives 04:00+13:45, 15
 *   minutes later. Use `floorToZone` for a boundary that never exceeds the instant.
 *
 * @param value ISO 8601 zoned datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode
 * @returns Rounded ISO 8601 zoned datetime string, or "" on invalid input
 *
 * @example roundZoned("2024-06-15T12:34:56-05:00[America/New_York]", { smallestUnit: "hour" }) // "2024-06-15T13:00:00-05:00[America/New_York]"
 * @example roundZoned("2024-06-15T12:34:56-05:00[America/New_York]", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:45:00-05:00[America/New_York]"
 * @example roundZoned("2024-09-29T03:50:00+13:45[Pacific/Chatham]", { smallestUnit: "hour", roundingMode: "trunc" }) // "2024-09-29T04:00:00+13:45[Pacific/Chatham]" (after the input — TC39 wall-clock rounding)
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
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidZonedDateTime(value)) return "";

  // Polyfill limitation: year/month/week not supported for ZonedDateTime.round()
  const supportedUnits: readonly string[] = [
    "day",
    "hour",
    "minute",
    "second",
    "millisecond",
    "microsecond",
    "nanosecond",
  ];
  if (!supportedUnits.includes(smallestUnit)) return "";

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
}
