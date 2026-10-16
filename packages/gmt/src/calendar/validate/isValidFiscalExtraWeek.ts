import type { FiscalExtraWeek } from "../../types";

/**
 * Return true when `value` is a valid FiscalExtraWeek: the period a 53rd week is added to.
 *
 * - Valid values are `"firstPeriod"` and `"lastPeriod"`. The ONS retail trading periods (UK)
 *   add a five-week January; the NRF 4-5-4 calendar (US) adds the week to the end.
 * - Accepts any input type and returns false for non-string values.
 * - Use it to narrow a value read from config, an env var or a form before building a
 *   `FiscalCalendar`.
 *
 * @param value candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidFiscalExtraWeek("firstPeriod") // true
 * @example isValidFiscalExtraWeek("lastPeriod") // true
 * @example isValidFiscalExtraWeek("lastQuarter") // false
 * @example isValidFiscalExtraWeek(12) // false
 */
export function isValidFiscalExtraWeek(
  value: unknown,
): value is FiscalExtraWeek {
  if (typeof value !== "string") {
    return false;
  }

  return value === "firstPeriod" || value === "lastPeriod";
}
