import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "./startOrEndOfUnix";

/**
 * Return the end of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, finds the end of the unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns the last millisecond of the real local `unit` containing `value` in `timeZone` — just before the next bucket `floorToZone` would return — so the result is never before `value`: the second pass of a repeated fall-back hour ends at its own 1:59:59.999.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday"), disambiguation and offset (deprecated, ignored)
 * @returns Unix epoch number representing the end of the unit, or null on invalid input
 *
 * @example endOfUnix(1706659200000, "year", { timeZone: "UTC" }) // 1735689599999
 * @example endOfUnix(1706659200000, "month", { timeZone: "UTC" }) // 1706745599999
 * @example endOfUnix(1706659200, "day", { epochUnit: "seconds", timeZone: "UTC" }) // 1706745599
 * @example endOfUnix(-86400000, "year", { timeZone: "UTC" }) // -1 (end of 1969)
 * @example endOfUnix(1730616300000, "hour", { timeZone: "America/New_York" }) // 1730617199999 (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back; its hour ends at the second 1:59:59.999)
 * @example endOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject" }) // 1730617199999 (the deprecated option is ignored)
 */
export function endOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
  },
): number | null {
  return startOrEndOfUnix(value, unit, options ?? {}, true);
}
