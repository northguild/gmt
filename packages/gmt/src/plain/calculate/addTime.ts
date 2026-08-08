import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { Overflow, TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` added to `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") is accepted for API consistency with sibling
 * add functions, but PlainTime arithmetic always wraps around the clock (e.g. 23:00 + 2 hours
 * = 01:00) rather than producing an out-of-range value, so it has no observable effect here.
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to add
 * @param options optional: overflow ("constrain" | "reject" — accepted but inert, see above)
 * @returns ISO PlainTime string after addition, or "" on invalid input
 *
 * @example addTime("12:00:00", { hours: 1 }) // "13:00:00"
 * @example addTime("invalid", { hours: 1 }) // ""
 */
export function addTime(
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
      .add(units, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
