import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { DateDurationUnit, Overflow } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` added according to `units`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 * to Jan 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDate string
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "constrain" }) // "2024-02-29"
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "reject" }) // ""
 */
export function addDate(
  value: string /* ISO 8601 date */,
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
      .add(units, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
