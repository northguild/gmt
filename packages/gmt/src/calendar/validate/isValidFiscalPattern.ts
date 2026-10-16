import type { FiscalPattern } from "../../types";

/**
 * Return true when `pattern` is a valid FiscalPattern.
 *
 * - Valid patterns are: "4-5-4", "4-4-5", "5-4-4". One published 4-5-4 example is the NRF
 *   retail calendar (US).
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 * - A pattern read from config, an env var or a form is a bare string until something narrows
 *   it. Narrow it here; to check a whole calendar before `getFiscalPeriod`, whose null also
 *   means an invalid date, use `isValidFiscalCalendar`.
 *
 * @param pattern candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidFiscalPattern("4-5-4") // true
 * @example isValidFiscalPattern("4-4-5") // true
 * @example isValidFiscalPattern("5-4-4") // true
 * @example isValidFiscalPattern("4-5-5") // false (a 53-week year's last quarter under `"lastPeriod"`, not a pattern)
 * @example isValidFiscalPattern("454") // false
 * @example isValidFiscalPattern("invalid") // false
 * @example isValidFiscalPattern(454) // false
 * @example isValidFiscalPattern(null) // false
 */
export function isValidFiscalPattern(
  pattern: unknown,
): pattern is FiscalPattern {
  if (typeof pattern !== "string") {
    return false;
  }

  return pattern === "4-5-4" || pattern === "4-4-5" || pattern === "5-4-4";
}
