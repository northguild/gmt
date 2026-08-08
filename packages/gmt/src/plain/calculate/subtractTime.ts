import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { Overflow, TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") is accepted for API consistency with sibling
 * subtract functions, but PlainTime arithmetic always wraps around the clock (e.g. 01:00 - 2 hours
 * = 23:00) rather than producing an out-of-range value, so it has no observable effect here.
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject" — accepted but inert, see above)
 * @returns ISO PlainTime string after subtraction, or "" on invalid input
 *
 * @example subtractTime("14:30:00", { hours: 1 }) // "13:30:00"
 * @example subtractTime("invalid", { hours: 1 }) // ""
 */
export function subtractTime(
  value: string,
  units: Partial<Record<TimeDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  const validTime = isValidTime(value);
  const validUnits = Object.keys(units).every(isValidTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validTime || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const time = Temporal.PlainTime.from(value);
    return time
      .subtract(units, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
