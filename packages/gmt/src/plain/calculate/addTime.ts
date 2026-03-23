import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `amount` added to `value` using the
 * specified `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the add.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainTime string
 * @param amount numeric amount to add
 * @param unit Temporal.TimeUnit (hour|minute|second|...)
 * @returns ISO PlainTime string with amount added, or "" on invalid input
 */
export function addTime(
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

  switch (unit) {
    case "hour":
      return time.add({ hours: amount }).toString();
    case "minute":
      return time.add({ minutes: amount }).toString();
    case "second":
      return time.add({ seconds: amount }).toString();
    case "millisecond":
      return time.add({ milliseconds: amount }).toString();
    case "microsecond":
      return time.add({ microseconds: amount }).toString();
    case "nanosecond":
      return time.add({ nanoseconds: amount }).toString();
  }
}
