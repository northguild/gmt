import { Temporal } from "@js-temporal/polyfill";

import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { startOfDateTime } from "../calculate/startOfDateTime";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two ISO datetime strings for equality at a given unit.
 *
 * - Equality means both values share the same start-of-`unit` boundary, so
 *   `"month"` requires the same month AND year — March 2023 and March 2024 are
 *   NOT equal by month, matching date-fns's `isSameMonth` and Luxon's
 *   `dt.hasSame(other, "month")`.
 * - Supports the full `Temporal.DateUnit | Temporal.TimeUnit` range, down to
 *   `"nanosecond"`.
 * - `unit` accepts the singular or plural name (`"day"` or `"days"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns false.
 * - Returns false for an unsupported unit or invalid input.
 * - Takes no `fractionalSecondDigits`: equality compares full-precision `unit` boundaries, and output
 *   digits cannot change which bucket a value is in. That ignored option was removed in 1.16.0; to
 *   compare more coarsely, pass a coarser unit (0 digits is `"second"`, 3 is `"millisecond"`).
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
 * @param unit date or time unit, singular or plural, to compare by
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns true if both datetimes share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areDateTimesEqualBy("2024-03-15T10:00:00", "2024-03-15T18:00:00", "day") // true
 * @example areDateTimesEqualBy("2024-03-15T10:30:00", "2024-03-15T10:45:00", "hour") // true
 * @example areDateTimesEqualBy("2024-03-15T10:30:00", "2024-03-15T11:00:00", "hour") // false
 * @example areDateTimesEqualBy("2023-03-15T10:00:00", "2024-03-15T10:00:00", "month") // false (same month, different year)
 * @example areDateTimesEqualBy("2024-05-15T10:20:30.123", "2024-05-15T10:20:30.999", "milliseconds") // false (different milliseconds)
 * @example areDateTimesEqualBy("2024-05-15T10:20:30.123", "2024-05-15T10:20:30.999", "second") // true
 * @example areDateTimesEqualBy("invalid", "2024-03-15T10:00:00", "day") // false
 */
export function areDateTimesEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.SmallestUnit<Temporal.DateTimeUnit>,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
  },
): boolean {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return false;
    }

    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    if (
      !isValidDateTime(value1) ||
      !isValidDateTime(value2) ||
      !isValidDateTimeUnit(resolvedUnit) ||
      weekStartsOn === null
    ) {
      return false;
    }

    try {
      const start1 = startOfDateTime(value1, resolvedUnit, { weekStartsOn });
      const start2 = startOfDateTime(value2, resolvedUnit, { weekStartsOn });

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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
