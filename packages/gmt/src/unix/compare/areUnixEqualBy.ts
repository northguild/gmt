import type { Temporal } from "@js-temporal/polyfill";
import { startOfUnix } from "../calculate/startOfUnix";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Compare two Unix epoch values for equality at a given unit.
 *
 * - Both values are resolved to the start of `unit` in `options.timeZone`
 *   (default: `"UTC"`) before comparison, so `"day"` compares
 *   calendar days in that zone, not raw epoch buckets.
 * - The start of `unit` is the real local bucket (see `startOfUnix`), so two epochs are equal
 *   only when they fall in the same bucket — including one a zone transition shortened, like
 *   `Pacific/Chatham`'s 15-minute 03:00 hour on its 2024 spring-forward.
 * - `"month"` requires the same month AND year, matching `areDateTimesEqualBy`.
 * - Each value is a safe integer or a string of optionally negative ASCII digits; `unit` may be
 *   singular or plural. An omitted `timeZone` is UTC; `"local"` is the system zone.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns false.
 * - Returns false for an unsupported unit (including `"quarter"`) or invalid input.
 *
 * Mapping from date-fns (Decision 5, `context/roadmap/issues/J.md`):
 * - `isSameDay(a, b)` → `areUnixEqualBy(a, b, "day")`
 * - `isSameMonth(a, b)` → `areUnixEqualBy(a, b, "month")`
 * - `isSameYear(a, b)` → `areUnixEqualBy(a, b, "year")`
 *
 * @param value1 first Unix epoch: a safe integer or a digit string
 * @param value2 second Unix epoch, in the same unit
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to compare by
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"), weekStartsOn ("monday" | "sunday")
 * @returns true if both values share the same start-of-unit boundary, false on an unsupported unit or invalid input
 *
 * @example areUnixEqualBy(1710498000000, 1710503000000, "day", { timeZone: "UTC" }) // true (both fall on 2024-03-15 in UTC)
 * @example areUnixEqualBy(1704067200000, 1735689600000, "year", { timeZone: "UTC" }) // false (2024-01-01 vs 2025-01-01)
 * @example areUnixEqualBy("1710498000000", 1710503000000, "days") // true (digit string, plural unit, UTC by default)
 * @example areUnixEqualBy(Number.NaN, 1710498000000, "day") // false
 */
export function areUnixEqualBy(
  value1: number | string,
  value2: number | string,
  unit: Temporal.DateTimeUnit | Temporal.PluralUnit<Temporal.DateTimeUnit>,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): boolean {
  if (!isOptionsArgument(options)) {
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
