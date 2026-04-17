import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Return the month (1-12) from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the month.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromUnix(1700000000000) // "09"
 * @example parseMonthFromUnix(1704067200000) // "01"
 * @example parseMonthFromUnix(-86400, { epochUnit: "seconds" }) // "12"
 */
export function parseMonthFromUnix(
  value: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
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

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    return zdt.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
