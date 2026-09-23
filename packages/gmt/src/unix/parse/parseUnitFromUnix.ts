import type { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Units extractable from a unix epoch value via `parseUnitFromUnix`. Covers the
 * full set of date/time units plus sub-millisecond precision.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `year` | Full year, no padding (e.g. `2024`). |
 * | `month` | Zero-padded 2 (e.g. `03`). |
 * | `week` | Week-of-year, 1–53: ISO 8601 for `weekStartsOn: "monday"`, UTS #35 (minimal days 1) for `"sunday"`, so late-December days can be week 1. |
 * | `day` | Zero-padded 2. |
 * | `dayOfWeek` | 1 (Mon)–7 (Sun). |
 * | `hour` | Zero-padded 2. |
 * | `minute` | Zero-padded 2. |
 * | `second` | Zero-padded 2. |
 * | `millisecond` | Zero-padded 3. |
 * | `microsecond` | Zero-padded 3. |
 * | `nanosecond` | Zero-padded 3 (Temporal's `nanosecond` field is 0–999). |
 *
 * @example
 * import { PlainNowUnit } from "@northguild/gmt/unix";
 * const u: PlainNowUnit = "month";
 */
export type PlainNowUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "dayOfWeek"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";

/**
 * Extract a unit from a unix epoch value.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond". Temporal units may also be plural ("hours").
 * - `value` is a safe integer or a string of optionally negative ASCII digits; an omitted `timeZone` is UTC and `"local"` is the system zone.
 * - `microsecond` and `nanosecond` are the 0–999 Temporal fields, zero-padded to 3 digits.
 * - Converts to ZonedDateTime then extracts the unit.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "", for every unit.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param unit unit to extract (e.g. "year", "month", "hour")
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid), weekStartsOn ("monday" | "sunday"); a non-object value (such as `null`) is invalid
 * @returns extracted unit value as string, or "" on invalid input
 *
 * @example parseUnitFromUnix(1700000000000, "year") // "2023"
 * @example parseUnitFromUnix(1700000000, "hour", { epochUnit: "seconds", timeZone: "UTC" }) // "22"
 * @example parseUnitFromUnix(1704067200000, "week", { timeZone: "UTC" }) // "1"
 * @example parseUnitFromUnix(1704067200000, "week", { weekStartsOn: "sunday", timeZone: "UTC" }) // "1"
 * @example parseUnitFromUnix(-86400, "year", { epochUnit: "seconds", timeZone: "UTC" }) // "1969"
 * @example parseUnitFromUnix("1709217045123", "hours") // "14" (digit string, plural unit, UTC by default)
 * @example parseUnitFromUnix(1709217045123, "nanosecond") // "000"
 * @example parseUnitFromUnix("", "year") // "" (a blank string is not epoch 0)
 */
export function parseUnitFromUnix(
  value: number | string,
  unit: PlainNowUnit | Temporal.PluralUnit<Temporal.DateTimeUnit>,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): string {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return "";
    }
    const zdt = unixZonedDateTime(value, options);
    const weekStartsOn = resolveWeekStartsOn(options?.weekStartsOn);

    if (zdt === null || typeof unit !== "string" || weekStartsOn === null) {
      return "";
    }

    try {
      switch (resolveDateTimeUnit(unit)) {
        case "year":
          return zdt.year.toString();
        case "month":
          return zdt.month.toString().padStart(2, "0");
        case "week": {
          return (
            getWeekNumber(zdt.toPlainDate().toString(), weekStartsOn) ?? 0
          ).toString();
        }
        case "day":
          return zdt.day.toString().padStart(2, "0");
        case "dayOfWeek":
          return zdt.dayOfWeek.toString();
        case "hour":
          return zdt.hour.toString().padStart(2, "0");
        case "minute":
          return zdt.minute.toString().padStart(2, "0");
        case "second":
          return zdt.second.toString().padStart(2, "0");
        case "millisecond":
          return zdt.millisecond.toString().padStart(3, "0");
        case "microsecond":
          return zdt.microsecond.toString().padStart(3, "0");
        case "nanosecond":
          return zdt.nanosecond.toString().padStart(3, "0");
        default:
          return "";
      }
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
