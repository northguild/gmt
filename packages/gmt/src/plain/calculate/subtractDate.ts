import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { DateDurationUnit, Overflow } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDate string
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after subtraction, or "" on invalid input
 *
 * @example subtractDate("2024-03-15", { day: 5 }) // "2024-03-10"
 * @example subtractDate("invalid", { day: 5 }) // ""
 * @example subtractDate("2024-03-31", { months: 1 }, { overflow: "reject" }) // ""
 */
export function subtractDate(
  value: string,
  units: Partial<Record<DateDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  const validDate = isValidDate(value);
  const validUnits = Object.keys(units).every(isValidDateDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validDate || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const date = Temporal.PlainDate.from(value);
    return date
      .subtract(units, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
