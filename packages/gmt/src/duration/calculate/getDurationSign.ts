import { Temporal } from "@js-temporal/polyfill";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Report whether an ISO 8601 duration is negative, zero-length, or positive.
 *
 * - Uses Temporal.Duration.from and reads .sign: -1, 0, or 1.
 * - Zero is its own result, not folded into the positive case — "PT0S" is 0, and so is
 *   "-PT0S", since a negated zero is still zero.
 * - Needs no `relativeTo`: a duration's sign is carried on its components, not derived from
 *   how long they measure, so calendar-unit durations answer fine.
 * - Returns null when `value` is not a valid ISO 8601 duration string — distinct from the 0
 *   a valid zero-length duration returns.
 *
 * @param value ISO 8601 duration string
 * @returns -1 for a negative duration, 0 for zero-length, 1 for positive, or null on invalid input
 *
 * @example getDurationSign("P1DT2H") // 1
 * @example getDurationSign("-P1DT2H") // -1
 * @example getDurationSign("PT0S") // 0
 * @example getDurationSign("-PT0S") // 0
 * @example getDurationSign("-P1Y") // -1 (no relativeTo needed)
 * @example getDurationSign("not a duration") // null
 */
export function getDurationSign(value: string): number | null {
  if (!isValidDuration(value)) {
    return null;
  }

  try {
    return Temporal.Duration.from(value).sign;
  } catch {
    return null;
  }
}
