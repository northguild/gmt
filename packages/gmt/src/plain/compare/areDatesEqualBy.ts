import { Temporal } from "@js-temporal/polyfill";

import { startOfDate } from "../calculate/startOfDate";
import { isValidDate } from "../validate";
import { areDatesEqual } from "./areDatesEqual";

const supported: Temporal.DateUnit[] = ["year", "month", "week", "day"];

/**
 * Compare two ISO date strings for equality at a given calendar unit.
 *
 * - Equality means both values share the same start-of-`unit` boundary, so
 *   `"month"` requires the same month AND year — March 2023 and March 2024 are
 *   NOT equal by month, matching date-fns's `isSameMonth` and Luxon's
 *   `dt.hasSame(other, "month")`. This is a common point of confusion for
 *   callers expecting a bare "same month-of-year" comparison.
 * - `"day"` is equivalent to `areDatesEqual`.
 * - `"year"`, `"month"`, `"week"` are computed via `startOfDate`.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areDatesEqualBy(a, b, "day")`
 * - `isSameWeek(a, b, options)` → `areDatesEqualBy(a, b, "week", { weekStartsOn })`
 * - `isSameMonth(a, b)` → `areDatesEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areDatesEqualBy(a, b, "year")`
 *
 * @param value1 first ISO date string
 * @param value2 second ISO date string
 * @param unit Temporal.DateUnit to compare by ("year" | "month" | "week" | "day")
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns true if both dates share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areDatesEqualBy("2024-03-15", "2024-03-20", "month") // true
 * @example areDatesEqualBy("2023-03-15", "2024-03-15", "month") // false (same month, different year)
 * @example areDatesEqualBy("2024-03-15", "2024-03-16", "day") // false
 * @example areDatesEqualBy("2024-03-15", "2024-03-15", "hour" as never) // false (unsupported unit)
 * @example areDatesEqualBy("invalid", "2024-03-15", "month") // false
 */
export function areDatesEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.DateUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): boolean {
  if (
    !isValidDate(value1) ||
    !isValidDate(value2) ||
    !supported.includes(unit)
  ) {
    return false;
  }

  // "day" has no coarser boundary to reset, so this is just direct equality.
  if (unit === "day") {
    return areDatesEqual(value1, value2);
  }

  try {
    const start1 = startOfDate(value1, unit, optionsArg);
    const start2 = startOfDate(value2, unit, optionsArg);

    return start1 !== "" && start1 === start2;
  } catch {
    return false;
  }
}
