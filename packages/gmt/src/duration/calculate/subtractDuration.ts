import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Combine two ISO 8601 duration strings by subtraction.
 *
 * - Uses Temporal.Duration.from and .subtract to combine, then .toString() to re-emit.
 * - Temporal.Duration.prototype.subtract has no `relativeTo` option, so combining any pair
 *   where either operand has a nonzero years/months/weeks component throws and
 *   results in "" — calendar-unit duration arithmetic needs a reference point that
 *   this function does not accept.
 * - The result may be negative (e.g. subtracting a larger duration from a smaller one).
 * - Returns "" if either operand is not a valid ISO 8601 duration string.
 *
 * @param a ISO 8601 duration string
 * @param b ISO 8601 duration string
 * @returns ISO 8601 duration string representing a - b, or "" on invalid input
 *
 * @example subtractDuration("P1D", "PT2H") // "PT22H"
 * @example subtractDuration("PT1H", "PT2H") // "-PT1H"
 * @example subtractDuration("P1Y", "P1M") // "" (calendar units need relativeTo, unsupported)
 * @example subtractDuration("P1D", "not a duration") // ""
 */
export function subtractDuration(a: string, b: string): string {
  if (!isValidDuration(a) || !isValidDuration(b)) {
    return "";
  }

  try {
    return Temporal.Duration.from(a).subtract(b).toString();
  } catch {
    return "";
  }
}
