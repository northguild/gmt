import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTimeUnit } from "../../plain/validate";
import type { DateTimeUnit } from "../../types";
import { startOfZoned } from "../calculate/startOfZoned";
import { isValidZonedDateTime } from "../validate";

/**
 * Compare two zoned ISO datetime strings for equality at a given unit.
 *
 * - Equality is measured on each value's own local wall-clock fields (its own
 *   time zone), not on the underlying instant or time zone identifier — the
 *   same instant can be "the same day" in one zone and a different day in
 *   another, and this function answers per each value's own zone, the way
 *   Luxon's `dt.hasSame(other, unit)` does for zoned `DateTime`s.
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areZonedEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areZonedEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areZonedEqualBy(a, b, "year")`
 *
 * @param value1 first zoned ISO datetime string
 * @param value2 second zoned ISO datetime string
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to compare by
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns true if both values share the same local start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areZonedEqualBy("2024-03-15T10:00:00-04:00[America/New_York]", "2024-03-15T20:00:00+01:00[Europe/Berlin]", "day") // true (both are local March 15 in their own zone)
 * @example areZonedEqualBy("2024-03-15T23:30:00-04:00[America/New_York]", "2024-03-16T04:30:00+00:00[UTC]", "day") // false (same instant, different local calendar day per zone)
 * @example areZonedEqualBy("invalid", "2024-03-15T10:00:00-04:00[America/New_York]", "day") // false
 */
export function areZonedEqualBy(
  value1: string,
  value2: string,
  unit: DateTimeUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): boolean {
  if (
    !isValidZonedDateTime(value1) ||
    !isValidZonedDateTime(value2) ||
    !isValidDateTimeUnit(unit)
  ) {
    return false;
  }

  try {
    const start1 = startOfZoned(value1, unit, optionsArg);
    const start2 = startOfZoned(value2, unit, optionsArg);

    if (start1 === "" || start2 === "") return false;

    const local1 = Temporal.ZonedDateTime.from(start1).toPlainDateTime();
    const local2 = Temporal.ZonedDateTime.from(start2).toPlainDateTime();

    return Temporal.PlainDateTime.compare(local1, local2) === 0;
  } catch {
    return false;
  }
}
