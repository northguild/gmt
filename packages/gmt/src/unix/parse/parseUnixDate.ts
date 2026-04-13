import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { getSystemTimeZone } from "../../plain/get";
import { convertUnixToZoned } from "../../unix/convert";

/**
 * Extract the date portion from a unix epoch value.
 *
 * - `value` is a numeric epoch in milliseconds by default, or seconds when
 *   `epochUnit` is "seconds".
 * - Uses system timeZone to interpret the epoch by default, or the provided IANA timeZone.
 * - Returns empty string on invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number)
 * @param options epochUnit optional unit specifier: "seconds" | "milliseconds", timeZone optional IANA timeZone
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 */
export function parseUnixDate(
  value: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
  },
): string {
  const { epochUnit = "milliseconds", timeZone = getSystemTimeZone() } =
    options ?? {};

  if (!isValidAmount(value)) return "";

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
