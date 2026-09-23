// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import type { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { startOrEndOfUnix } from "../../internal/startOrEndOfUnix";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the specified unit for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, finds the start of the unit, converts back to epoch.
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond", singular or plural. For quarters use `startOfQuarterForUnix` / `endOfQuarterForUnix`; `"quarter"` returns null.
 * - Returns the real start of the local `unit` containing `value` in `timeZone` — the same bucket `floorToZone` uses — so the result is never after `value`: the second pass of a repeated fall-back hour starts at its own 1am, and `Pacific/Chatham`'s 15-minute spring-forward hour starts at 03:45.
 * - Takes no `disambiguation` or `offset`: a boundary is always a real instant, as TC39's `startOfDay()`
 *   takes neither. Those ignored options were removed in 1.16.0.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null, for every unit.
 * - Returns null for invalid input.
 * - `value` is a safe integer or a digit string (`"1706659200000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone. An unknown zone returns
 *   null.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param unit Temporal.DateUnit | Temporal.TimeUnit to specify the start
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"), weekStartsOn ("monday" | "sunday")
 * @returns Unix epoch number representing the start of the unit, or null on invalid input
 *
 * @example startOfUnix(1706659200000, "year", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200000, "month", { timeZone: "UTC" }) // 1704067200000
 * @example startOfUnix(1706659200, "day", { epochUnit: "seconds", timeZone: "UTC" }) // 1706659200
 * @example startOfUnix(-86400000, "year", { timeZone: "UTC" }) // -31536000000 (start of 1969)
 * @example startOfUnix(1730616300000, "hour", { timeZone: "America/New_York" }) // 1730613600000 (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back; its hour starts at the second 1am)
 * @example startOfUnix(1706780800, "days", { epochUnit: "second" }) // 1706745600 (plural unit, singular epochUnit, UTC by default)
 * @example startOfUnix(1706659200000, "quarter") // null (use startOfQuarterForUnix)
 * @example startOfUnix(NaN, "day") // null
 */
export function startOfUnix(
  value: number | string,
  unit: Temporal.DateTimeUnit | Temporal.PluralUnit<Temporal.DateTimeUnit>,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const resolvedUnit =
      typeof unit === "string" ? resolveDateTimeUnit(unit) : unit;

    if (!isValidDateTimeUnit(resolvedUnit)) return null;

    return startOrEndOfUnix(value, resolvedUnit, options ?? {}, false);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
