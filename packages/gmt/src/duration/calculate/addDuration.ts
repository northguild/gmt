import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Combine two ISO 8601 duration strings by addition.
 *
 * - Uses Temporal.Duration.from and .add to combine, then .toString() to re-emit.
 * - Temporal.Duration.prototype.add has no `relativeTo` option, so combining any pair
 *   where either operand has a nonzero years/months/weeks component throws and
 *   results in "" — calendar-unit duration arithmetic needs a reference point that
 *   this function does not accept.
 * - Returns "" if either operand is not a valid ISO 8601 duration string.
 *
 * @param a ISO 8601 duration string
 * @param b ISO 8601 duration string
 * @returns ISO 8601 duration string representing a + b, or "" on invalid input
 *
 * @example addDuration("P1D", "PT2H") // "P1DT2H"
 * @example addDuration("PT1H", "-PT2H") // "-PT1H"
 * @example addDuration("P1Y", "P1M") // "" (calendar units need relativeTo, unsupported)
 * @example addDuration("P1D", "not a duration") // ""
 */
export function addDuration(a: string, b: string): string {
  if (!isValidDuration(a) || !isValidDuration(b)) {
    return "";
  }

  try {
    return Temporal.Duration.from(a).add(b).toString();
  } catch {
    return "";
  }
}
