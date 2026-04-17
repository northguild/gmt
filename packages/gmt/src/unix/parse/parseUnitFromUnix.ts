import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

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
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Converts to ZonedDateTime then extracts the unit.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param unit unit to extract (e.g. "year", "month", "hour")
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday")
 * @returns extracted unit value as string, or "" on invalid input
 *
 * @example parseUnitFromUnix(1700000000000, "year") // "2023"
 * @example parseUnitFromUnix(1700000000, "hour", { epochUnit: "seconds" }) // "12"
 * @example parseUnitFromUnix(1704067200000, "week") // "1"
 * @example parseUnitFromUnix(1704067200000, "week", { weekStartsOn: "sunday" }) // "1"
 * @example parseUnitFromUnix(-86400, { epochUnit: "seconds" }, "year") // "1969"
 */
export function parseUnitFromUnix(
  value: number | string,
  unit: PlainNowUnit,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): string {
  const numValue = typeof value === "string" ? Number(value) : value;
  const epochUnit = options?.epochUnit ?? "milliseconds";

  if (epochUnit === "seconds") {
    if (!isValidUnixSeconds(numValue)) return "";
  } else {
    if (!isValidUnixMilliseconds(numValue)) return "";
  }

  const timeZone = options?.timeZone ?? getSystemTimeZone();
  if (!timeZone) return "";

  const zoned =
    typeof options?.epochUnit === "undefined"
      ? convertUnixToZoned(numValue, timeZone)
      : convertUnixToZoned(numValue, timeZone, options.epochUnit);
  if (!zoned) return "";

  const weekStartsOn = options?.weekStartsOn ?? "monday";

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    switch (unit) {
      case "year":
        return zdt.year.toString();
      case "month":
        return zdt.month.toString().padStart(2, "0");
      case "week": {
        return (
          getWeekNumber(
            `${zdt.year}-${zdt.month.toString().padStart(2, "0")}-${zdt.day.toString().padStart(2, "0")}`,
            weekStartsOn,
          ) ?? 0
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
        return (zdt.microsecond ?? 0).toString().padStart(3, "0");
      case "nanosecond":
        return (zdt.nanosecond ?? 0).toString().padStart(3, "0");
      default:
        return "";
    }
  } catch {
    return "";
  }
}
