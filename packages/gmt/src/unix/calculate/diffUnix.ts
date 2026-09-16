import { Temporal } from "@js-temporal/polyfill";
import { zonedUntil } from "../../internal";
import {
  isValidUnixEpochPair,
  resolveUnixTimeZone,
} from "../../internal/resolveUnixTimeZone";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidUnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the difference between two Unix timestamps measured in the given unit.
 *
 * - Uses Temporal.Instant.until() to calculate the difference.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 *
 * @param value1 first Unix timestamp
 * @param value2 second Unix timestamp
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUnix(1706745600000, 1706659200000, "days", { timeZone: "UTC" }) // -1 (measured from the first value to the second)
 * @example diffUnix(1706745600, 1706659200, "days", { epochUnit: "seconds", timeZone: "UTC" }) // -1
 * @example diffUnix(0, -86400000, "days", { timeZone: "UTC" }) // -1 (1970-01-01 until 1969-12-31 is minus one day)
 * @example diffUnix(NaN, 0, "days") // null
 */
export function diffUnix(
  value1: number,
  value2: number,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  } & RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = resolveUnixTimeZone(options?.timeZone);

  if (!timeZone || !isValidUnixUnit(epochUnit)) return null;

  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);

  if (!validUnits) {
    return null;
  }

  if (!isValidUnixEpochPair(value1, value2)) {
    return null;
  }

  try {
    const instant1 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value1 * 1000 : value1,
    );
    const instant2 = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value2 * 1000 : value2,
    );

    const zdt1 = instant1.toZonedDateTimeISO(timeZone);
    const zdt2 = instant2.toZonedDateTimeISO(timeZone);

    const duration = zonedUntil(zdt1, zdt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });

    if (isSingleUnit) {
      return duration[units] ?? 0;
    }

    return units.reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<DateTimeDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
