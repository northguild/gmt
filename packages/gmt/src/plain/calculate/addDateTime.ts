import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";

/**
 * Return a PlainDateTime ISO string with `amount` added according to `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the add.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add (e.g. { days: 1, months: 2 })
 * @returns ISO PlainDateTime string after addition, or "" on invalid input
 */
export function addDateTime(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  const validDateTime = isValidDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validDateTime || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.add(units).toString();
  } catch {
    return "";
  }
}
