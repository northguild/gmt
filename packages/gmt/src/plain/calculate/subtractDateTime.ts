import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

/**
 * Return a PlainDateTime ISO string with `amount` subtracted using `unit`.
 *
 * - Validates inputs before performing the subtraction.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @param amount numeric amount to subtract
 * @param unit Temporal.DateTimeUnit (year|month|day|hour|...)
 * @returns ISO PlainDateTime string after subtraction, or "" on invalid input
 */
export function subtractDateTime(
  value: string,
  amount: number,
  unit: Temporal.DateTimeUnit,
): string {
  const validDateTime = isValidDateTime(value);
  const validUnit = isValidDateTimeUnit(unit);
  const validAmount = isValidAmount(amount);

  if (!validDateTime || !validUnit || !validAmount) {
    return "";
  }

  const dateTime = Temporal.PlainDateTime.from(value);

  return dateTime.subtract({ [`${unit}s`]: amount }).toString();
}
