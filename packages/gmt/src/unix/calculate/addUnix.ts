import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { getSystemTimeZone } from "../../plain/get";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Add a temporal amount to a Unix epoch value and return the resulting epoch.
 *
 * - Accepts Unix timestamps in milliseconds (default) or seconds.
 * - Uses the system timeZone to interpret the epoch, or a provided IANA timeZone.
 * - Returns 0 for invalid inputs.
 *
 * @param value Unix timestamp (number)
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param options epochUnit optional "seconds" | "milliseconds", timeZone optional IANA timeZone
 * @example addUnix(1706659200000, { days: 1 }) // 1706745600000
 * @example addUnix(1706659200, { days: 1 }, { epochUnit: "seconds" }) // 1706745600
 * @returns Unix epoch number after addition, or null on invalid input
 */
export function addUnix(
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
    const result = zdt.add(units);
    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;
    return epoch;
  } catch {
    return null;
  }
}
