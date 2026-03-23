import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

/**
 * Return a PlainDateTime ISO string with `amount` added according to `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the add.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @param amount numeric amount to add
 * @param unit Temporal.DateTimeUnit (year|month|day|hour|...)
 * @returns ISO PlainDateTime string after addition, or "" on invalid input
 */
export function addDateTime(
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

  switch (unit) {
    case "year":
      return dateTime.add({ years: amount }).toString();
    case "month":
      return dateTime.add({ months: amount }).toString();
    case "week":
      return dateTime.add({ weeks: amount }).toString();
    case "day":
      return dateTime.add({ days: amount }).toString();
    case "hour":
      return dateTime.add({ hours: amount }).toString();
    case "minute":
      return dateTime.add({ minutes: amount }).toString();
    case "second":
      return dateTime.add({ seconds: amount }).toString();
    case "millisecond":
      return dateTime.add({ milliseconds: amount }).toString();
    case "microsecond":
      return dateTime.add({ microseconds: amount }).toString();
    case "nanosecond":
      return dateTime.add({ nanoseconds: amount }).toString();
  }
}
