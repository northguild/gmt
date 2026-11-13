import type { Temporal } from "../../internal/temporal";

import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { plainDateOf } from "../../internal/inputChecks";
import { sameDateBy, sameIsoDateLike } from "../../internal/plainDateSteps";
import { isOptionsArgument } from "../../internal/isObject";

const supported: readonly string[] = ["year", "month", "week", "day"];

/**
 * Compare two ISO date strings for equality at a given calendar unit.
 *
 * - Equality means both values share the same start-of-`unit` boundary, so
 *   `"month"` requires the same month AND year — March 2023 and March 2024 are
 *   NOT equal by month. A calendar month is a year and a month together, as in
 *   Temporal's `PlainYearMonth`, not a bare month-of-year number. This is a
 *   common point of confusion for callers expecting a bare "same month-of-year"
 *   comparison.
 * - `"day"` matches `areDatesEqual` for PlainDate inputs only: `areDatesEqual` also accepts
 *   PlainDateTime strings (`areDatesEqual("2024-01-01", "2024-01-01T10:00")` is `true`), while this
 *   function accepts PlainDate strings only (`areDatesEqualBy` with those inputs and `"day"` is
 *   `false`).
 * - `"year"`, `"month"`, `"week"` are computed via `startOfDate`.
 * - `unit` accepts the singular or plural name (`"day"` or `"days"`), as Temporal does.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Migrating from date-fns:
 * - `isSameDay(a, b)` → `areDatesEqualBy(a, b, "day")`
 * - `isSameWeek(a, b)` → `areDatesEqualBy(a, b, "week", { weekStartsOn: "sunday" })`: date-fns
 *   starts the week on Sunday (`weekStartsOn: 0`) by default, GMT on Monday
 * - `isSameWeek(a, b, { weekStartsOn: 1 })` → `areDatesEqualBy(a, b, "week")`
 * - `isSameMonth(a, b)` → `areDatesEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areDatesEqualBy(a, b, "year")`
 *
 * @param value1 first ISO date string
 * @param value2 second ISO date string
 * @param unit date unit to compare by ("year" | "month" | "week" | "day", or its plural)
 * @param optionsArg How the week is defined
 * @returns true if both dates share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areDatesEqualBy("2024-03-15", "2024-03-20", "month") // true
 * @example areDatesEqualBy("2024-03-15", "2024-03-20", "months") // true
 * @example areDatesEqualBy("2024-03-15", "2024-03-20", "week", { weekStartsOn: "tuesday" }) // false (invalid weekStartsOn)
 * @example areDatesEqualBy("2023-03-15", "2024-03-15", "month") // false (same month, different year)
 * @example areDatesEqualBy("2024-03-15", "2024-03-16", "day") // false
 * @example areDatesEqualBy("2024-03-15", "2024-03-15", "hour" as never) // false (unsupported unit)
 * @example areDatesEqualBy("invalid", "2024-03-15", "month") // false
 */
export function areDatesEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.SmallestUnit<Temporal.DateUnit>,
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

    const date1 = plainDateOf(value1);
    const date2 = plainDateOf(value2);

    if (
      date1 === null ||
      date2 === null ||
      !supported.includes(resolvedUnit) ||
      weekStartsOn === null
    ) {
      return false;
    }

    // "day" has no coarser boundary to reset, so this is just direct equality.
    if (resolvedUnit === "day") {
      return sameIsoDateLike(value1, value2);
    }

    try {
      return sameDateBy(
        date1,
        date2,
        resolvedUnit as Temporal.DateUnit,
        weekStartsOn,
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
