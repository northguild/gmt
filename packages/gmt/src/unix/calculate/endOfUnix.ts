import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "./startOrEndOfUnix";

/**
 * Return the end of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, sets to end of unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - `disambiguation` controls DST gap/overlap resolution when the boundary jump lands on an ambiguous local time: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in null).
 * - `offset` controls whether the source's existing UTC offset is kept when computing the new boundary: "prefer" (Temporal's own default — keeps the source offset whenever still valid, which **makes `disambiguation` inert** for almost every case here since the source offset is nearly always still valid after a same-day field reset), "use", "ignore" (**this function's default** — always recomputes from time zone + local time, discarding the stale offset; this is what makes `disambiguation` actually take effect), or "reject" (throws if the source offset is invalid for the new fields, independent of `disambiguation`). Leave `offset` at its default unless you specifically need Temporal's raw `.with()` semantics.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the end
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns Unix epoch number representing the end of the unit, or null on invalid input
 *
 * @example endOfUnix(1706659200000, "year") // 1735689600000
 * @example endOfUnix(1706659200000, "month") // 1708012800000
 * @example endOfUnix(1706659200, "day", { epochUnit: "seconds" }) // 1706736000
 * @example endOfUnix(-86400000, "year") // -1 (end of 1969)
 * @example endOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject" }) // null (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back overlap; end-of-hour is ambiguous)
 * @example endOfUnix(1730616300000, "hour", { timeZone: "America/New_York", disambiguation: "reject", offset: "prefer" }) // 1730617199999 (setting offset to "prefer" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and "reject" never fires)
 */
export function endOfUnix(
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
  return startOrEndOfUnix(value, unit, options ?? {}, true);
}
