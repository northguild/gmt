import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTimeUnit } from "../../plain/validate";
import type { DateTimeUnit } from "../../types";
import { startOfZoned } from "../calculate/startOfZoned";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two zoned ISO datetime strings for equality at a given unit.
 *
 * - Equality is measured on each value's own local wall-clock fields (its own
 *   time zone), not on the underlying instant or time zone identifier — the
 *   same instant can be "the same day" in one zone and a different day in
 *   another, and this function answers per each value's own zone, the way
 *   Luxon's `dt.hasSame(other, unit)` does for zoned `DateTime`s.
 * - Each value's start-of-unit is its real local bucket (see `startOfZoned`), so a bucket a
 *   zone transition shortened is still its own unit: in `Pacific/Chatham` on its 2024
 *   spring-forward, 03:50 and 04:05 are different hours, because the 03:00 hour lasted only
 *   from 03:45 to 04:00.
 * - Two values in the same time zone are equal only when their bucket starts are the same
 *   instant, as in `areUnixEqualBy`: both passes of New York's repeated 01:00 on its 2024
 *   fall-back read the same wall clock but are different hours. Values in different zones are
 *   compared by their buckets' local labels, since their instants never line up.
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - `unit` accepts the singular or plural name (`"day"` or `"days"`), as Temporal does.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns false.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areZonedEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areZonedEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areZonedEqualBy(a, b, "year")`
 *
 * @param value1 first zoned ISO datetime string
 * @param value2 second zoned ISO datetime string
 * @param unit date or time unit, singular or plural, to compare by
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday")
 * @returns true if both values share the same local start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areZonedEqualBy("2024-03-15T10:00:00-04:00[America/New_York]", "2024-03-15T20:00:00+01:00[Europe/Berlin]", "day") // true (both are local March 15 in their own zone)
 * @example areZonedEqualBy("2024-03-15T10:00:00-04:00[America/New_York]", "2024-03-15T20:00:00+01:00[Europe/Berlin]", "days") // true (plural unit)
 * @example areZonedEqualBy("2024-03-15T23:30:00-04:00[America/New_York]", "2024-03-16T04:30:00+00:00[UTC]", "day") // false (same instant, different local calendar day per zone)
 * @example areZonedEqualBy("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]", "hour") // false (both read 01:30, but they sit in the two different real 01:00 hours)
 * @example areZonedEqualBy("invalid", "2024-03-15T10:00:00-04:00[America/New_York]", "day") // false
 */
export function areZonedEqualBy(
  value1: string,
  value2: string,
  unit: Temporal.SmallestUnit<DateTimeUnit>,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): boolean {
  if (!isOptionsArgument(optionsArg)) {
    return false;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);
  const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);

  if (
    !isValidZonedDateTime(value1) ||
    !isValidZonedDateTime(value2) ||
    !isValidDateTimeUnit(resolvedUnit) ||
    weekStartsOn === null
  ) {
    return false;
  }

  try {
    const start1 = startOfZoned(value1, resolvedUnit, { weekStartsOn });
    const start2 = startOfZoned(value2, resolvedUnit, { weekStartsOn });

    if (start1 === "" || start2 === "") return false;

    const zoned1 = zonedDateTimeFrom(start1);
    const zoned2 = zonedDateTimeFrom(start2);

    // Same zone: one real bucket is one instant, so a repeated wall clock is not a match.
    if (zoned1.timeZoneId === zoned2.timeZoneId) {
      return (
        Temporal.Instant.compare(zoned1.toInstant(), zoned2.toInstant()) === 0
      );
    }

    return (
      Temporal.PlainDateTime.compare(
        zoned1.toPlainDateTime(),
        zoned2.toPlainDateTime(),
      ) === 0
    );
  } catch {
    return false;
  }
}
