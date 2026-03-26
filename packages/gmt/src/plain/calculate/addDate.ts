import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { DateDurationUnit } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` added according to `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the add.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add (e.g. { day: 1, month: 2 })
 * @returns ISO PlainDate string after addition, or "" on invalid input
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
