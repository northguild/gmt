import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { getSystemTimeZone } from "../../plain/get";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Subtract a temporal amount from a Unix epoch value and return the resulting epoch.
 *
 * - Accepts Unix timestamps in milliseconds (default) or seconds.
 * - Returns null for invalid inputs.
 *
 * @param value Unix timestamp (number)
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options epochUnit optional "seconds" | "milliseconds", timeZone optional IANA timeZone
 * @example subtractUnix(1706745600000, { days: 1 }) // 1706659200000
 * @example subtractUnix(1706745600, { days: 1 }, { epochUnit: "seconds" }) // 1706659200
 * @returns Unix epoch number after subtraction, or null on invalid input
 */
export function subtractUnix(
  value: number,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();

  if (!timeZone || !isValidTimeZone(timeZone)) return null;

  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validUnits || !validAmounts) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value * 1000 : value,
    );

    const zdt = instant.toZonedDateTimeISO(timeZone);
    const result = zdt.subtract(units);
    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;
    return epoch;
  } catch {
    return null;
  }
}
