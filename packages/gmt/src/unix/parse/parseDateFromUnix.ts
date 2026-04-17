import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";

/**
 * Extract the date portion from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the PlainDate.
 * - Uses system timezone if not specified.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 *
 * @example parseDateFromUnix(1700000000000) // "2023-11-15"
 * @example parseDateFromUnix(1700000000, { epochUnit: "seconds" }) // "2023-11-15"
 * @example parseDateFromUnix(-86400, { epochUnit: "seconds" }) // "1969-12-31"
 */
export function parseDateFromUnix(
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

  const zoned = epochUnit
    ? convertUnixToZoned(value, timeZone, epochUnit)
    : convertUnixToZoned(value, timeZone);
  if (!zoned) return "";

  try {
    const zdt = Temporal.ZonedDateTime.from(zoned);
    return zdt.toPlainDate().toString();
  } catch {
    return "";
  }
}
