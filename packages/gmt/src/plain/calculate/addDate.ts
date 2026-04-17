import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { DateDurationUnit } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` added according to `units`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 */
export function addDate(
  value: string /* ISO 8601 date */,
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
    return date.add(units).toString();
  } catch {
    return "";
  }
}
