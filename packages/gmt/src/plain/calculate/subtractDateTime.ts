import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";

/**
 * Return a PlainDateTime ISO string with `amount` subtracted using `unit`.
 *
 * - Validates inputs before performing the subtraction.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract (e.g. { days: 1, months: 2 })
 * @example subtractDateTime("2024-03-15T12:00:00", { day: 5 }) // "2024-03-10T12:00:00"
 * @example subtractDateTime("2024-03-15T12:00:00", { month: 1, year: 1 }) // "2023-02-15T12:00:00"
 * @example subtractDateTime("invalid", { day: 5 }) // ""
 * @example subtractDateTime("2024-03-15T12:00:00", { invalidUnit: 5 }) // ""
 * @example subtractDateTime("2024-03-15T12:00:00", { day: -5 }) // "2024-03-20T12:00:00"
 * @returns ISO PlainDateTime string after subtraction, or "" on invalid input
 */
export function subtractDateTime(
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
    return dateTime.subtract(units).toString();
  } catch {
    return "";
  }
}
