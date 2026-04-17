import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to subtract
 * @returns ISO PlainTime string after subtraction, or "" on invalid input
 *
 * @example subtractTime("14:30:00", { hours: 1 }) // "13:30:00"
 * @example subtractTime("invalid", { hours: 1 }) // ""
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
