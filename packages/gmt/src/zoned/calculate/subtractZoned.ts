import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
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
 * subtractZoned("2024-02-29T14:30:00+00:00[UTC]", { years: 1 })
 * // => "2023-02-28T14:30:00+00:00[UTC]"
 * ```
 *
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract (e.g. { days: 1, months: 2 })
 * @returns zoned ISO 8601 string on success, or empty string on invalid input
 */
export function subtractZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  const validZonedDateTime = isValidZonedDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.subtract(units).toString();
  } catch {
    return "";
  }
}
