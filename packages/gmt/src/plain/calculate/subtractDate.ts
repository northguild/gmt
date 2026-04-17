import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { DateDurationUnit } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to subtract
 * @returns ISO PlainDate string after subtraction, or "" on invalid input
 *
 * @example subtractDate("2024-03-15", { day: 5 }) // "2024-03-10"
 * @example subtractDate("invalid", { day: 5 }) // ""
 */
export function subtractDate(
  value: string,
  units: Partial<Record<DateDurationUnit, number>>,
): string {
  const validDate = isValidDate(value);
  const validUnits = Object.keys(units).every(isValidDateDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validDate || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const date = Temporal.PlainDate.from(value);
    return date.subtract(units).toString();
  } catch {
    return "";
  }
}
