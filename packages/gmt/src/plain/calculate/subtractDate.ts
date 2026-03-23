import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDate, isValidDateUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` subtracted according to `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before subtracting.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @param amount numeric amount to subtract
 * @param unit Temporal.DateUnit (year|month|week|day)
 * @returns ISO PlainDate string after subtraction, or "" on invalid input
 */
export function subtractDate(
  value: string,
  amount: number,
  unit: Temporal.DateUnit,
): string {
  const validDate = isValidDate(value);
  const validUnit = isValidDateUnit(unit);
  const validAmount = isValidAmount(amount);

  if (!validDate || !validUnit || !validAmount) {
    return "";
  }

  const date = Temporal.PlainDate.from(value);

  return date.subtract({ [`${unit}s`]: amount }).toString();
}
