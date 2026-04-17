import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Return the week number from a unix epoch value.
 *
 * - By default uses ISO weeks (Monday-based).
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), weekStartsOn ("monday" | "sunday")
 * @returns Week number (1-53) or null on invalid input
 *
 * @example parseWeekFromUnix(1704067200000) // 1
 * @example parseWeekFromUnix(1704067200000, { weekStartsOn: "sunday" }) // 1
 * @example parseWeekFromUnix(-86400, { epochUnit: "seconds" }) // 1
 */
export function parseWeekFromUnix(
  value: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  const numValue = typeof value === "string" ? Number(value) : value;
  const epochUnit = options?.epochUnit ?? "milliseconds";

  if (epochUnit === "seconds") {
    if (!isValidUnixSeconds(numValue)) return null;
  } else {
    if (!isValidUnixMilliseconds(numValue)) return null;
  }

  const timeZone = options?.timeZone ?? getSystemTimeZone();
  if (!timeZone) return null;

  const zoned =
    typeof options?.epochUnit === "undefined"
      ? convertUnixToZoned(numValue, timeZone)
      : convertUnixToZoned(numValue, timeZone, options.epochUnit);
  if (!zoned) return null;

  const weekStartsOn = options?.weekStartsOn ?? "monday";

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    return getWeekNumber(
      `${zdt.year}-${zdt.month.toString().padStart(2, "0")}-${zdt.day.toString().padStart(2, "0")}`,
      weekStartsOn,
    );
  } catch {
    return null;
  }
}
