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
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract (e.g. { days: 1, months: 2 })
 * @example subtractZoned("2024-03-10T12:00:00[America/New_York]", { days: 5 }) // "2024-03-05T12:00:00-05:00[America/New_York]"
 * @example subtractZoned("2024-03-10T12:00:00[America/New_York]", { months: 1, years: 1 }) // "2023-02-10T12:00:00-05:00[America/New_York]"
 * @example subtractZoned("invalid", { days: 5 }) // ""
 * @example subtractZoned("2024-03-10T12:00:00[America/New_York]", { invalidUnit: 5 }) // ""
 * @example subtractZoned("2024-03-10T12:00:00[America/New_York]", { days: -5 }) // "2024-03-15T12:00:00-04:00[America/New_York]"
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
