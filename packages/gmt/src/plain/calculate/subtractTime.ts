import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `amount` subtracted from `value`
 * using the specified `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the operation.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @param amount numeric amount to subtract
 * @param unit Temporal.TimeUnit (hour|minute|second|...)
 * @returns ISO PlainTime string with amount subtracted, or "" on invalid input
 */
export function subtractTime(
  value: string,
  amount: number,
  unit: Temporal.TimeUnit,
): string {
  const validTime = isValidTime(value);
  const validUnit = isValidTimeUnit(unit);
  const validAmount = isValidAmount(amount);

  if (!validTime || !validUnit || !validAmount) {
    return "";
  }

  const time = Temporal.PlainTime.from(value);

  return time.subtract({ [`${unit}s`]: amount }).toString();
}
