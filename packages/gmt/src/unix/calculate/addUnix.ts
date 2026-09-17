import { Temporal } from "@js-temporal/polyfill";
import { addToZoned, isValidAmount, resolveOverflow } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";
import { isValidUnixUnit } from "../validate/isValidUnixUnit";

/**
 * Add a temporal amount to a Unix epoch value and return the resulting epoch.
 *
 * - Converts to ZonedDateTime, adds the duration, then converts back to epoch.
 * - Validates duration units and values.
 * - Returns null for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 * to Jan 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in null).
 *
 * @param value Unix timestamp (number)
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA; omitted means the system (host) time zone), overflow ("constrain" | "reject")
 * @returns Unix epoch number after addition, or null on invalid input
 *
 * @example addUnix(1706659200000, { days: 1 }) // 1706745600000
 * @example addUnix(1706659200, { days: 1 }, { epochUnit: "seconds" }) // 1706745600
 * @example addUnix(-86400000, { days: 1 }) // 0 (Dec 31 1969 + 1 day = Jan 1 1970)
 * @example addUnix(1.5, { days: 1 }) // null (not an integer epoch)
 */
export function addUnix(
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
  if (!isValidUnixUnit(epochUnit)) return null;

  const validUnits =
    typeof units === "object" &&
    units !== null &&
    Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = validUnits && Object.values(units).every(isValidAmount);

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
    const result = addToZoned(zdt, units, { overflow });
    const epoch =
      epochUnit === "seconds"
        ? Math.floor(result.epochMilliseconds / 1000)
        : result.epochMilliseconds;
    return epoch;
  } catch {
    return null;
  }
}
