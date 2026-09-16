import { Temporal } from "@js-temporal/polyfill";

import type { FractionalDigit } from "../../types";
import { startOfDateTime } from "../calculate/startOfDateTime";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

/**
 * Compare two ISO datetime strings for equality at a given unit.
 *
 * - Equality means both values share the same start-of-`unit` boundary, so
 *   `"month"` requires the same month AND year — March 2023 and March 2024 are
 *   NOT equal by month, matching date-fns's `isSameMonth` and Luxon's
 *   `dt.hasSame(other, "month")`.
 * - Supports the full `Temporal.DateUnit | Temporal.TimeUnit` range, down to
 *   `"nanosecond"`.
 * - Returns false for an unsupported unit or invalid input.
 * - `fractionalSecondDigits` is ignored (deprecated). It used to shorten both boundaries before
 *   they were compared, so values in different `unit` buckets could compare equal (".123" and ".999"
 *   by `"millisecond"` with 0 digits). To keep the old coarser comparison, pass the unit the digits
 *   stood for instead: 0 digits is `"second"`, 3 is `"millisecond"`, 6 is `"microsecond"`.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areDateTimesEqualBy(a, b, "day")`
 * - `isSameHour(a, b)` → `areDateTimesEqualBy(a, b, "hour")`
 * - `isSameMinute(a, b)` → `areDateTimesEqualBy(a, b, "minute")`
 * - `isSameSecond(a, b)` → `areDateTimesEqualBy(a, b, "second")`
 * - `isSameMonth(a, b)` → `areDateTimesEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areDateTimesEqualBy(a, b, "year")`
 *
 * @param value1 first ISO datetime string
 * @param value2 second ISO datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to compare by
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (deprecated, ignored)
 * @returns true if both datetimes share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areDateTimesEqualBy("2024-03-15T10:00:00", "2024-03-15T18:00:00", "day") // true
 * @example areDateTimesEqualBy("2024-03-15T10:30:00", "2024-03-15T10:45:00", "hour") // true
 * @example areDateTimesEqualBy("2024-03-15T10:30:00", "2024-03-15T11:00:00", "hour") // false
 * @example areDateTimesEqualBy("2023-03-15T10:00:00", "2024-03-15T10:00:00", "month") // false (same month, different year)
 * @example areDateTimesEqualBy("2024-05-15T10:20:30.123", "2024-05-15T10:20:30.999", "millisecond", { fractionalSecondDigits: 0 }) // false (different milliseconds)
 * @example areDateTimesEqualBy("2024-05-15T10:20:30.123", "2024-05-15T10:20:30.999", "second") // true (the old 0-digit result)
 * @example areDateTimesEqualBy("invalid", "2024-03-15T10:00:00", "day") // false
 */
export function areDateTimesEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    /**
     * @deprecated Ignored. Equality compares the full-precision `unit` boundaries; output digits cannot change which bucket a value is in. Will be removed in the next major.
     */
    fractionalSecondDigits?: FractionalDigit;
  },
): boolean {
  if (
    !isValidDateTime(value1) ||
    !isValidDateTime(value2) ||
    !isValidDateTimeUnit(unit)
  ) {
    return false;
  }

  try {
    // Full-precision boundaries: the output digits never take part in the comparison.
    const boundaryOptions = { weekStartsOn: optionsArg?.weekStartsOn };
    const start1 = startOfDateTime(value1, unit, boundaryOptions);
    const start2 = startOfDateTime(value2, unit, boundaryOptions);

    if (start1 === "" || start2 === "") return false;

    return (
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(start1),
        Temporal.PlainDateTime.from(start2),
      ) === 0
    );
  } catch {
    return false;
  }
}
