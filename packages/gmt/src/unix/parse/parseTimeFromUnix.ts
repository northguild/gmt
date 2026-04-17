import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Extract the time portion from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the PlainTime.
 * - Uses system timezone if not specified.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUnix(1700000000000) // "04:13:20"
 * @example parseTimeFromUnix(1700000000, { epochUnit: "seconds" }) // "04:13:20"
 * @example parseTimeFromUnix(-86400, { epochUnit: "seconds" }) // "00:00:00"
 */
export function parseTimeFromUnix(
  value: number,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
  },
): string {
  const epochUnit = options?.epochUnit ?? "milliseconds";

  if (epochUnit === "seconds") {
    if (!isValidUnixSeconds(value)) return "";
  } else {
    if (!isValidUnixMilliseconds(value)) return "";
  }

  const timeZone = options?.timeZone ?? getSystemTimeZone();
  if (!timeZone) return "";

  const zoned = options?.epochUnit
    ? convertUnixToZoned(value, timeZone, options.epochUnit)
    : convertUnixToZoned(value, timeZone);
  if (!zoned) return "";

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    return zdt.toPlainTime().toString();
  } catch {
    return "";
  }
}
