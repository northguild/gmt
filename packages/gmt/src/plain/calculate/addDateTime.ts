import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";

/**
 * Return a PlainDateTime ISO string with `units` added to `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. adding 1 month
 * to Jan 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDateTime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDateTime string after addition, or "" on invalid input
 *
 * @example addDateTime("2024-03-10T12:00:00", { days: 5 }) // "2024-03-15T12:00:00"
 * @example addDateTime("invalid", { days: 5 }) // ""
 * @example addDateTime("2024-01-31T12:00:00", { months: 1 }, { overflow: "reject" }) // ""
 */
export function addDateTime(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  const validDateTime = isValidDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validDateTime || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime
      .add(units, { overflow: resolveOverflow(options?.overflow) })
      .toString();
  } catch {
    return "";
  }
}
