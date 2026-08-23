import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { startOrEndOfUtc } from "./startOrEndOfUtc";

/**
 * Return the end of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Converts to ZonedDateTime, sets to end of unit, converts back to Instant.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns UTC Instant string representing the end of the unit, or "" on invalid input
 *
 * @example endOfUtc("2024-03-15T14:30:45Z", "year") // "2024-12-31T23:59:59.999999999Z"
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
