import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Round a Unix timestamp to the specified unit.
 *
 * - Converts to ZonedDateTime, rounds, converts back to epoch.
 * - Supports: "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Date units ("year", "month", "week") are not supported by the Temporal polyfill's ZonedDateTime.round() — they return null.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode, epochUnit, timeZone
 * @returns Rounded Unix epoch number, or null on invalid input
 *
 * @example roundUnix(1706659200000, { smallestUnit: "hour" }) // 1706662800000 (rounded up to next hour)
 * @example roundUnix(1706659200000, { smallestUnit: "day", epochUnit: "seconds" }) // 1706640000 (start of day in seconds)
 * @example roundUnix(1706659200000, { smallestUnit: "hour", roundingIncrement: 2 }) // 1706662800000 (rounded to nearest 2-hour mark)
 * @example roundUnix(-86400000, { smallestUnit: "day" }) // -86400000 (start of day for negative timestamp)
 * @example roundUnix("invalid", { smallestUnit: "hour" }) // null
 * @example roundUnix(NaN, { smallestUnit: "hour" }) // null
 */
export function roundUnix(
  value: number,
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
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): number | null {
  const {
    smallestUnit,
    roundingIncrement,
    roundingMode,
    epochUnit = "milliseconds",
    timeZone = getSystemTimeZone(),
  } = options;

  if (
    !timeZone ||
    !isValidDateTimeUnit(smallestUnit) ||
    !isValidTimeZone(timeZone)
  ) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

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
  if (!supportedUnits.includes(smallestUnit)) {
    return null;
  }

  try {
    let epochMs = epochUnit === "seconds" ? value * 1000 : value;
    const instant = Temporal.Instant.fromEpochMilliseconds(epochMs);
    const source = instant.toZonedDateTimeISO(timeZone);

    const result = source.round({
      smallestUnit,
      roundingIncrement,
      roundingMode,
    });

    epochMs = result.epochMilliseconds;
    return epochUnit === "seconds" ? Math.floor(epochMs / 1000) : epochMs;
  } catch {
    return null;
  }
}
