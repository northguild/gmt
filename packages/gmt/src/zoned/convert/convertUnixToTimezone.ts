import type { UnixUnit } from "../../plain/validate/isValidUnixUnit";
import { convertUnixToZoned } from "./convertUnixToZoned";

export function convertUnixToTimezone(
  value: number,
  timeZone: string,
  ...unitInput: [unit?: UnixUnit]
): string {
  /**
   * Convert a unix epoch value to a zoned ISO 8601 datetime string.
   *
   * - `value` is a numeric epoch in either milliseconds (default) or seconds.
   * - `timeZone` is an IANA timezone id.
   * - When `unit` is omitted milliseconds are assumed.
   * - Returns an empty string "" for invalid inputs.
   *
   * @param value epoch value in milliseconds or seconds
   * @param timeZone IANA timezone identifier
   * @param unit optional unit, "seconds" or "milliseconds"
   * @returns zoned ISO 8601 string or empty string when invalid
   */
  if (unitInput.length === 0) {
    return convertUnixToZoned(value, timeZone);
  }

  return convertUnixToZoned(value, timeZone, unitInput[0]);
}
