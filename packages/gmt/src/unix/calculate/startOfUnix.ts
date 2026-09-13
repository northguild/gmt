import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "./startOrEndOfUnix";

/**
 * Return the start of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, finds the start of the unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - With neither `disambiguation` nor `offset` passed, returns the real start of the local `unit` containing `value` in `timeZone` — the same bucket `floorToZone` uses — so the result is never after `value`: the second pass of a repeated fall-back hour starts at its own 1am, and `Pacific/Chatham`'s 15-minute spring-forward hour starts at 03:45.
 * - Passing `disambiguation` or `offset` opts into Temporal's wall-clock `.with()` resolution of the reset fields instead, unchanged from earlier releases. That result can land after `value` in a gap, or on the other pass of an overlap.
 * - `disambiguation` (opt-in path) controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` (opt-in path) controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**the default once either option is passed** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`).
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore" once either is passed)
 * @returns Unix epoch number representing the start of the unit, or null on invalid input
 *
 * @example startOfUnix(1706659200000, "year", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200000, "month", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200, "day", { epochUnit: "seconds", timeZone: "UTC" }) // 1706659200
 * @example startOfUnix(-86400000, "year", { timeZone: "UTC" }) // -31536000000 (start of 1969)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York" }) // 1730613600000 (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back; its hour starts at the second 1am)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject" }) // null (opting in: the wall-clock 1am is ambiguous between the two passes)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject", offset: "prefer" }) // 1730613600000 (setting offset to "prefer" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and "reject" never fires)
 */
export function startOfUnix(
  value: number,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): number | null {
  return startOrEndOfUnix(value, unit, options ?? {}, false);
}
