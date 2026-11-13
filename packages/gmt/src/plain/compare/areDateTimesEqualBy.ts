import { Temporal } from "../../internal/temporal";

import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { plainDateTimeOf } from "../../internal/inputChecks";
import { startOfPlainDateTime } from "../../internal/plainDateSteps";
import { isDateTimeUnitName } from "../../internal/unitNames";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two ISO datetime strings for equality at a given unit.
 *
 * - Equality means both values share the same start-of-`unit` boundary, so
 *   `"month"` requires the same month AND year — March 2023 and March 2024 are
 *   NOT equal by month. A calendar month is a year and a month together, as in
 *   Temporal's `PlainYearMonth`, not a bare month-of-year number.
 * - Supports the full `Temporal.DateUnit | Temporal.TimeUnit` range, down to
 *   `"nanosecond"`.
 * - `unit` accepts the singular or plural name (`"day"` or `"days"`), as Temporal does.
 * - Returns false for an unsupported unit or invalid input.
 * - Takes no `fractionalSecondDigits`: equality compares full-precision `unit` boundaries, and output
 *   digits cannot change which bucket a value is in. That ignored option was removed in 1.16.0; to
 *   compare more coarsely, pass a coarser unit (0 digits is `"second"`, 3 is `"millisecond"`).
 *
 * Migrating from date-fns:
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
 * @param optionsArg How the week is defined
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
    /**
     * The first day of the week, which sets where a `"week"` unit starts. `"monday"` is the ISO
     * 8601 week, Monday to Sunday; `"sunday"` runs Sunday to Saturday. Any other value returns
     * false, whatever the unit.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
  },
): boolean {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return false;
    }

    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

    const dateTime1 = plainDateTimeOf(value1);
    const dateTime2 = plainDateTimeOf(value2);

    if (
      dateTime1 === null ||
      dateTime2 === null ||
      !isDateTimeUnitName(resolvedUnit) ||
      weekStartsOn === null
    ) {
      return false;
    }

    try {
      return (
        Temporal.PlainDateTime.compare(
          startOfPlainDateTime(dateTime1, resolvedUnit, weekStartsOn),
          startOfPlainDateTime(dateTime2, resolvedUnit, weekStartsOn),
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
