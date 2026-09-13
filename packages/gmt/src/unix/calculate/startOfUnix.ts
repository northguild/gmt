import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "./startOrEndOfUnix";

/**
 * Return the start of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, finds the start of the unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns the real start of the local `unit` containing `value` in `timeZone` — the same bucket `floorToZone` uses — so the result is never after `value`: the second pass of a repeated fall-back hour starts at its own 1am, and `Pacific/Chatham`'s 15-minute spring-forward hour starts at 03:45.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday"), disambiguation and offset (deprecated, ignored)
 * @returns Unix epoch number representing the start of the unit, or null on invalid input
 *
 * @example startOfUnix(1706659200000, "year", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200000, "month", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200, "day", { epochUnit: "seconds", timeZone: "UTC" }) // 1706659200
 * @example startOfUnix(-86400000, "year", { timeZone: "UTC" }) // -31536000000 (start of 1969)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York" }) // 1730613600000 (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back; its hour starts at the second 1am)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject" }) // 1730613600000 (the deprecated option is ignored)
 */
export function startOfUnix(
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
  return startOrEndOfUnix(value, unit, options ?? {}, false);
}
