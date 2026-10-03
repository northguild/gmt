import type { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { startOrEndOfUtc } from "../../internal/startOrEndOfUtc";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the specified date-time `unit` for a given UTC datetime string.
 *
 * - Converts to ZonedDateTime, sets to start of unit, converts back to Instant.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond", each also in its plural form (`"days"`), as Temporal accepts.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string
 * @param unit date or time unit, singular or plural, to specify the start
 * @param options Where a week starts, and the precision of the result
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
    /**
     * The first day of the week, which sets where a `"week"` unit starts. `"monday"` is the ISO
     * 8601 week, Monday to Sunday; `"sunday"` runs Sunday to Saturday. Any other value returns
     * `""`, whatever the unit.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
    /**
     * The number of fractional-second digits the result is written with, `0` to `9`, or `"auto"` to
     * drop trailing zeros. Fewer digits than `unit` names truncate, as Temporal's `toString` does.
     *
     * @defaultValue The digits `unit` names: `3` for `"millisecond"`, `6` for `"microsecond"`, `9`
     * for `"nanosecond"` and `0` for any coarser unit.
     */
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
