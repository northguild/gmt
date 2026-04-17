import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Return the day of week (1-7) from a unix epoch value.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUnix(1704067200000) // 1
 * @example parseDayOfWeekFromUnix(-86400, { epochUnit: "seconds" }) // 2
 */
export function parseDayOfWeekFromUnix(
  value: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
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

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    return zdt.dayOfWeek;
  } catch {
    return null;
  }
}
