import type { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { startOrEndOfUtc } from "../../internal/startOrEndOfUtc";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to Instant.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond", each also in its plural form (`"days"`), as Temporal accepts.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string
 * @param unit date or time unit, singular or plural, to specify the start
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns UTC Instant string representing the start of the unit, or "" on invalid input
 *
 * @example startOfUtc("2024-03-15T14:30:45Z", "year") // "2024-01-01T00:00:00Z"
 * @example startOfUtc("2024-03-15T14:30:45Z", "month") // "2024-03-01T00:00:00Z"
 * @example startOfUtc("2024-03-15T14:30:45Z", "days") // "2024-03-15T00:00:00Z"
 * @example startOfUtc("invalid", "year") // ""
 */
export function startOfUtc(
  value: string,
  unit: Temporal.SmallestUnit<Temporal.DateTimeUnit>,
  options?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    return startOrEndOfUtc(value, unit, options ?? {}, false);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
