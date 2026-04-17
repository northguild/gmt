import { Temporal } from "@js-temporal/polyfill";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { getSystemTimeZone } from "../../plain/get";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the difference between two Unix timestamps measured in the given unit.
 *
 * - Uses Temporal.Instant.until() to calculate the difference.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * @param value1 first Unix timestamp
 * @param value2 second Unix timestamp
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUnix(1706745600000, 1706659200000, "day") // 1
 * @example diffUnix(1706745600, 1706659200, "day", { epochUnit: "seconds" }) // 1
 * @example diffUnix(0, -86400000, "day") // 1 (Jan 1 1970 - Dec 31 1969 = 1 day)
 */
export function diffUnix(
  value1: number,
  value2: number,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): number | Record<DateTimeDurationUnit, number> | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();

  if (!timeZone || !isValidTimeZone(timeZone)) return null;

  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);

  if (!validUnits) {
    return null;
  }

  if (
    !Number.isFinite(value1) ||
    !Number.isInteger(value1) ||
    !Number.isFinite(value2) ||
    !Number.isInteger(value2)
  ) {
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

    const duration = zdt1.until(zdt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
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
