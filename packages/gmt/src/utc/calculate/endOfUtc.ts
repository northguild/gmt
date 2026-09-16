import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { startOrEndOfUtc } from "../../internal/startOrEndOfUtc";

/**
 * Return the end of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Converts to ZonedDateTime, sets to end of unit, converts back to Instant.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - The end is written at nanosecond precision by default, so the string names the end itself; an explicit `fractionalSecondDigits` (0, 3, 6 or 9) truncates it, as Temporal's `toString` does.
 * - Returns "" for invalid input.
 * - **Compatibility:** before 1.16.0 the default printed only the digits the unit names — none for
 *   `second` and coarser, 3 for `millisecond`, 6 for `microsecond` — which wrote a moment earlier
 *   than the end. Pass that `fractionalSecondDigits` to keep the previous string.
 *
 * @param value ISO UTC datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns UTC Instant string representing the end of the unit, or "" on invalid input
 *
 * @example endOfUtc("2024-03-15T14:30:45Z", "year") // "2024-12-31T23:59:59.999999999Z"
 * @example endOfUtc("2024-03-15T14:30:45Z", "month", { fractionalSecondDigits: 0 }) // "2024-03-31T23:59:59Z" — the pre-1.16.0 string
 * @example endOfUtc("2024-03-15T14:30:45Z", "month") // "2024-03-31T23:59:59.999999999Z"
 * @example endOfUtc("invalid", "year") // ""
 */
export function endOfUtc(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  return startOrEndOfUtc(value, unit, options ?? {}, true);
}
