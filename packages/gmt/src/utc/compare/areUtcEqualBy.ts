import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTimeUnit } from "../../plain";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { startOfUtc } from "../calculate/startOfUtc";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two UTC ISO datetime strings for equality at a given unit.
 *
 * - Both values are resolved to the start of `unit` in UTC before comparison,
 *   so `"day"` always means the UTC calendar day (UTC has no DST, so this is
 *   unambiguous).
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - `unit` accepts the singular or plural name (`"day"` or `"days"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns false.
 * - Returns false for an unsupported unit or invalid input.
 * - Takes no `fractionalSecondDigits`: equality compares full-precision `unit` boundaries, and output
 *   digits cannot change which bucket a value is in. That ignored option was removed in 1.16.0; to
 *   compare more coarsely, pass a coarser unit (0 digits is `"second"`, 3 is `"millisecond"`).
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areUtcEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areUtcEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areUtcEqualBy(a, b, "year")`
 *
 * @param value1 first UTC ISO datetime string
 * @param value2 second UTC ISO datetime string
 * @param unit date or time unit, singular or plural, to compare by
 * @param options optional: weekStartsOn ("monday" | "sunday")
 * @returns true if both values share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areUtcEqualBy("2024-03-15T02:00:00Z", "2024-03-15T22:00:00Z", "day") // true
 * @example areUtcEqualBy("2024-03-15T23:30:00Z", "2024-03-16T00:30:00Z", "day") // false
 * @example areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "milliseconds") // false (different milliseconds)
 * @example areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "second") // true
 * @example areUtcEqualBy("invalid", "2024-03-15T02:00:00Z", "day") // false
 */
export function areUtcEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.SmallestUnit<Temporal.DateTimeUnit>,
  options?: {
    weekStartsOn?: "monday" | "sunday";
  },
): boolean {
  try {
    if (!isOptionsArgument(options)) {
      return false;
    }

    const resolvedUnit = resolveDateTimeUnit(unit);
    const weekStartsOn = resolveWeekStartsOn(options?.weekStartsOn);

    if (
      !isValidUtc(value1) ||
      !isValidUtc(value2) ||
      !isValidDateTimeUnit(resolvedUnit) ||
      weekStartsOn === null
    ) {
      return false;
    }

    try {
      const start1 = startOfUtc(value1, resolvedUnit, { weekStartsOn });
      const start2 = startOfUtc(value2, resolvedUnit, { weekStartsOn });

      if (start1 === "" || start2 === "") return false;

      return (
        Temporal.Instant.compare(
          Temporal.Instant.from(start1),
          Temporal.Instant.from(start2),
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
