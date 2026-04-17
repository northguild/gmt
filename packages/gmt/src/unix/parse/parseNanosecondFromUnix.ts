import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Return the nanosecond (0-999) from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromUnix(1700000000000) // "000000000"
 * @example parseNanosecondFromUnix(-86400, { epochUnit: "seconds" }) // "000000000"
 */
export function parseNanosecondFromUnix(
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
    return (zdt.nanosecond ?? 0).toString().padStart(9, "0");
  } catch {
    return "";
  }
}
