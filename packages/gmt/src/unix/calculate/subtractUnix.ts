import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Subtract a temporal amount from a Unix epoch value and return the resulting epoch.
 *
 * - Converts to ZonedDateTime, subtracts the duration, then converts back to epoch.
 * - Validates duration units and values.
 * - Returns null for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in null).
 *
 * @param value Unix timestamp (number)
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), overflow ("constrain" | "reject")
 * @returns Unix epoch number after subtraction, or null on invalid input
 *
 * @example subtractUnix(1706745600000, { days: 1 }) // 1706659200000
 * @example subtractUnix(1706745600, { days: 1 }, { epochUnit: "seconds" }) // 1706659200
 * @example subtractUnix(0, { days: 1 }) // -86400000 (Jan 1 1970 - 1 day = Dec 31 1969)
 */
export function subtractUnix(
  value: number,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    overflow?: Overflow;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();
  const overflow = resolveOverflow(options?.overflow);

  if (!timeZone || !isValidTimeZone(timeZone)) return null;

  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validUnits || !validAmounts) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      epochUnit === "seconds" ? value * 1000 : value,
    );

    const zdt = instant.toZonedDateTimeISO(timeZone);
    const result = zdt.subtract(units, { overflow });
    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;
    return epoch;
  } catch {
    return null;
  }
}
