import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `amount` subtracted from `value`
 * using the specified `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the operation.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @param units Partial record of TimeDurationUnits with numeric values to subtract
 * @example subtractTime("14:30:00", { hour: 1 }) // "13:30:00"
 * @example subtractTime("14:30:00", { minute: 30 }) // "14:00:00"
 * @example subtractTime("14:30:00", { second: 45 }) // "14:29:15"
 * @example subtractTime("invalid", { hour: 1 }) // ""
 * @example subtractTime("14:30:00", { invalidUnit: 5 }) // ""
 * @example subtractTime("14:30:00", { hour: -1 }) // "15:30:00"
 * @returns ISO PlainTime string with amount subtracted, or "" on invalid input
 */
export function subtractTime(
  value: string,
  units: Partial<Record<TimeDurationUnit, number>>,
): string {
  const validTime = isValidTime(value);
  const validUnits = Object.keys(units).every(isValidTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validTime || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const time = Temporal.PlainTime.from(value);
    return time.subtract(units).toString();
  } catch {
    return "";
  }
}
