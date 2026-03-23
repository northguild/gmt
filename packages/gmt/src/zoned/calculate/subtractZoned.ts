import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate";

/**
 * Subtract a temporal amount from a zoned ISO 8601 datetime string and
 * return a zoned ISO 8601 string.
 *
 * - Inputs and outputs are ISO 8601 strings.
 * - Uses `@js-temporal/polyfill` `Temporal.ZonedDateTime` for arithmetic.
 * - On invalid input (bad zoned datetime, amount, or unit) this returns an
 *   empty string "" (consistent with library error handling semantics).
 *
 * Examples:
 * ```ts
 * subtractZoned("2024-02-29T14:30:00+00:00[UTC]", 1, "year")
 * // => "2023-02-28T14:30:00+00:00[UTC]"
 * ```
 *
 * @param value ISO 8601 zoned datetime string
 * @param amount numeric amount to subtract (can be negative)
 * @param unit Temporal.DateTimeUnit unit to subtract (e.g. "day", "hour")
 * @returns zoned ISO 8601 string on success, or empty string on invalid input
 */
export function subtractZoned(
  value: string,
  amount: number,
  unit: Temporal.DateTimeUnit,
): string {
  if (
    !isValidZonedDateTime(value) ||
    !isValidAmount(amount) ||
    !isValidDateTimeUnit(unit)
  ) {
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.subtract({ [`${unit}s`]: amount }).toString();
  } catch {
    return "";
  }
}
