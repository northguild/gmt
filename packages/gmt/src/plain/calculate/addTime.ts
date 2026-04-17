import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` added to `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to add
 * @returns ISO PlainTime string after addition, or "" on invalid input
 *
 * @example addTime("12:00:00", { hours: 1 }) // "13:00:00"
 * @example addTime("invalid", { hours: 1 }) // ""
 */
export function addTime(
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
    return time.add(units).toString();
  } catch {
    return "";
  }
}
