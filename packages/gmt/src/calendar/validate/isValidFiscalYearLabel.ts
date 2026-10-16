import type { FiscalYearLabel } from "../../types";

/**
 * Return true when `value` is a valid FiscalYearLabel: the rule that picks the calendar year
 * naming a fiscal year.
 *
 * - Valid values are `"startYear"`, `"endYear"` and `"majorityYear"`.
 * - Accepts any input type and returns false for non-string values.
 * - Use it to narrow a value read from config, an env var or a form before building a
 *   `FiscalCalendar` or passing `getQuarter` its options.
 *
 * @param value candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidFiscalYearLabel("startYear") // true
 * @example isValidFiscalYearLabel("endYear") // true
 * @example isValidFiscalYearLabel("majorityYear") // true
 * @example isValidFiscalYearLabel("fiscalYear") // false
 * @example isValidFiscalYearLabel(null) // false
 */
export function isValidFiscalYearLabel(
  value: unknown,
): value is FiscalYearLabel {
  if (typeof value !== "string") {
    return false;
  }

  return (
    value === "startYear" || value === "endYear" || value === "majorityYear"
  );
}
