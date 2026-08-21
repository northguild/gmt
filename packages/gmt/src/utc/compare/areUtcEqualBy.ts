import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { startOfUtc } from "../calculate/startOfUtc";
import { isValidUtc } from "../validate";

/**
 * Compare two UTC ISO datetime strings for equality at a given unit.
 *
 * - Both values are resolved to the start of `unit` in UTC before comparison,
 *   so `"day"` always means the UTC calendar day (UTC has no DST, so this is
 *   unambiguous).
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areUtcEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areUtcEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areUtcEqualBy(a, b, "year")`
 *
 * @param value1 first UTC ISO datetime string
 * @param value2 second UTC ISO datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to compare by
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns true if both values share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areUtcEqualBy("2024-03-15T02:00:00Z", "2024-03-15T22:00:00Z", "day") // true
 * @example areUtcEqualBy("2024-03-15T23:30:00Z", "2024-03-16T00:30:00Z", "day") // false
 * @example areUtcEqualBy("invalid", "2024-03-15T02:00:00Z", "day") // false
 */
export function areUtcEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): boolean {
  if (
    !isValidUtc(value1) ||
    !isValidUtc(value2) ||
    !isValidDateTimeUnit(unit)
  ) {
    return false;
  }

  try {
    const start1 = startOfUtc(value1, unit, options);
    const start2 = startOfUtc(value2, unit, options);

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
}
