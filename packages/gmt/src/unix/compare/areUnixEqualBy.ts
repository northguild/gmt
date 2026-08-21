import { isValidAmount } from "../../internal";
import type { DateTimeUnit } from "../../types";
import { startOfUnix } from "../calculate/startOfUnix";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Compare two Unix epoch values for equality at a given unit.
 *
 * - Both values are resolved to the start of `unit` in `options.timeZone`
 *   (default: the system time zone) before comparison, so `"day"` compares
 *   calendar days in that zone, not raw epoch buckets.
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - Returns false for an unsupported unit or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areUnixEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areUnixEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areUnixEqualBy(a, b, "year")`
 *
 * @param value1 first Unix epoch value
 * @param value2 second Unix epoch value
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to compare by
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday")
 * @returns true if both values share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areUnixEqualBy(1710498000000, 1710503000000, "day", { timeZone: "UTC" }) // true (both fall on 2024-03-15 in UTC)
 * @example areUnixEqualBy(1704067200000, 1735689600000, "year", { timeZone: "UTC" }) // false (2024-01-01 vs 2025-01-01)
 * @example areUnixEqualBy(Number.NaN, 1710498000000, "day") // false
 */
export function areUnixEqualBy(
  value1: number,
  value2: number,
  unit: DateTimeUnit,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): boolean {
  if (!isValidAmount(value1) || !isValidAmount(value2)) {
    return false;
  }

  try {
    const start1 = startOfUnix(value1, unit, options);
    const start2 = startOfUnix(value2, unit, options);

    return start1 !== null && start1 === start2;
  } catch {
    return false;
  }
}
