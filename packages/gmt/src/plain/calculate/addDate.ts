import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDate, isValidDateUnit } from "../validate";

/**
 * Return a PlainDate ISO string with `amount` added according to `unit`.
 *
 * - Validates `value`, `unit`, and `amount` before performing the add.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @param amount numeric amount to add
 * @param unit Temporal.DateUnit (year|month|week|day)
 * @returns ISO PlainDate string after addition, or "" on invalid input
 */
export function addDate(
  value: string /* ISO 8601 date */,
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

  switch (unit) {
    case "year":
      return date.add({ years: amount }).toString();
    case "month":
      return date.add({ months: amount }).toString();
    case "week":
      return date.add({ weeks: amount }).toString();
    case "day":
      return date.add({ days: amount }).toString();
  }
}
