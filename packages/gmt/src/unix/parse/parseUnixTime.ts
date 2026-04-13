import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../../unix/convert";

/**
 * Extract the time portion from a unix epoch value.
 *
 * - `value` is a numeric epoch in milliseconds by default, or seconds when
 *   `epochUnit` is "seconds".
 * - Uses system timeZone to interpret the epoch by default, or the provided IANA timeZone.
 * - Returns empty string on invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number)
 * @param options epochUnit optional unit specifier: "seconds" | "milliseconds", timeZone optional IANA timeZone
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 */
export function parseUnixTime(
  value: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): string {
  if (!isValidAmount(value)) return "";

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
