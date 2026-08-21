import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Flip the sign of an ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from and .negated, then .toString() to re-emit.
 * - Negating is a pure sign flip on every component, so it never needs `relativeTo` —
 *   calendar-unit durations round-trip through it fine, unlike `addDuration`/`durationAs`.
 * - A zero-length duration has no sign to flip and comes back as "PT0S", the canonical
 *   spelling Temporal emits for every zero duration (so "P0D" also renders "PT0S").
 * - Returns "" when `value` is not a valid ISO 8601 duration string.
 *
 * @param value ISO 8601 duration string
 * @returns ISO 8601 duration string with the opposite sign, or "" on invalid input
 *
 * @example negateDuration("P1DT2H") // "-P1DT2H"
 * @example negateDuration("-P1DT2H") // "P1DT2H"
 * @example negateDuration("P1Y2M") // "-P1Y2M" (no relativeTo needed)
 * @example negateDuration("PT0S") // "PT0S"
 * @example negateDuration("not a duration") // ""
 */
export function negateDuration(value: string): string {
  if (!isValidDuration(value)) {
    return "";
  }

  try {
    return Temporal.Duration.from(value).negated().toString();
  } catch {
    return "";
  }
}
