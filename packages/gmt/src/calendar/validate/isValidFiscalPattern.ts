import type { FiscalPattern } from "../../types";

/**
 * Return true when `pattern` is a valid FiscalPattern.
 *
 * - Valid patterns are: "4-5-4" (the NRF retail calendar), "4-4-5", "5-4-4".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 * - `getFiscalPeriod` returns null for a pattern it does not recognise — the same sentinel it
 *   returns for a date it cannot place. Check the pattern here to tell a misconfigured
 *   calendar apart from an unusable date: a pattern read from config, an env var or a form is
 *   a bare string until something narrows it.
 *
 * @param pattern candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidFiscalPattern("4-5-4") // true (the NRF retail calendar)
 * @example isValidFiscalPattern("4-4-5") // true
 * @example isValidFiscalPattern("5-4-4") // true
 * @example isValidFiscalPattern("4-5-5") // false (the shape a 53-week year's last quarter takes, not a pattern)
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
