import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Return the absolute value of an ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from and .abs, then .toString() to re-emit.
 * - Like `negateDuration`, this only touches signs, so it never needs `relativeTo` and works
 *   on calendar-unit durations.
 * - An already-positive duration is returned re-emitted, not rejected — but re-emitted means
 *   canonicalized, so "P0D" comes back as "PT0S".
 * - Returns "" when `value` is not a valid ISO 8601 duration string.
 *
 * @param value ISO 8601 duration string
 * @returns ISO 8601 duration string with a positive sign, or "" on invalid input
 *
 * @example absDuration("-P1DT2H") // "P1DT2H"
 * @example absDuration("P1DT2H") // "P1DT2H"
 * @example absDuration("-P1Y2M") // "P1Y2M" (no relativeTo needed)
 * @example absDuration("PT0S") // "PT0S"
 * @example absDuration("not a duration") // ""
 */
export function absDuration(value: string): string {
  if (!isValidDuration(value)) {
    return "";
  }

  try {
    return Temporal.Duration.from(value).abs().toString();
  } catch {
    return "";
  }
}
