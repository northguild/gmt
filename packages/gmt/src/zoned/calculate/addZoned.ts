import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Add a temporal amount to a zoned ISO 8601 datetime string and return a
 * zoned ISO 8601 string.
 *
 * - Inputs and outputs are ISO 8601 strings.
 * - Uses `@js-temporal/polyfill` `Temporal.ZonedDateTime` for arithmetic.
 * - On invalid input (bad zoned datetime, amount, or unit) this returns an
 *   empty string "" (consistent with library error handling semantics).
 *
 * Examples:
 * ```ts
 * addZoned("2024-02-29T14:30:00+00:00[UTC]", {years: 1}) // => "2025-02-28T14:30:00+00:00[UTC]"
 * // => "2025-02-28T14:30:00+00:00[UTC]"
 * ```
 *
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add (e.g. { days: 1, months: 2 })
 * @returns zoned ISO 8601 string on success, or empty string on invalid input
 */
export function addZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  const validZonedDateTime = isValidZonedDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    // TODO descriptive messages of what failed - likely could be GMT offset for historical changes and DST
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.add(units).toString();
  } catch {
    return "";
  }
}
