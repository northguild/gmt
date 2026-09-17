import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { getSystemTimeZone } from "../../zoned/get";
import { convertUnixToZoned } from "../convert";
import {
  isValidUnixMilliseconds,
  isValidUnixSeconds,
  type UnixUnit,
} from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { coerceUnixEpochNumber } from "../../internal/unixEpochValue";

/**
 * Return the week number from a unix epoch value.
 *
 * - By default uses ISO weeks (Monday-based).
 * - `weekStartsOn: "sunday"` numbers weeks within the calendar year (1–54, no week-year rollover),
 *   while `"monday"` is the ISO 8601 week of the week-year (1–53) — see `getWeekNumber`.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA; omitted means the system (host) time zone), weekStartsOn ("monday" | "sunday")
 * @returns Week number (1-53 for "monday", 1-54 for "sunday") or null on invalid input
 *
 * @example parseWeekFromUnix(1704067200000, { timeZone: "UTC" }) // 1
 * @example parseWeekFromUnix(1704067200000, { weekStartsOn: "sunday", timeZone: "UTC" }) // 1
 * @example parseWeekFromUnix(-86400, { epochUnit: "seconds" }) // 1
 * @example parseWeekFromUnix("") // null (a blank string is not epoch 0)
 * @example parseWeekFromUnix(1735646400000, { weekStartsOn: "sunday", timeZone: "UTC" }) // 53 (2024-12-31T12:00:00Z; no week-year rollover)
 */
export function parseWeekFromUnix(
  value: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  const numValue = coerceUnixEpochNumber(value);
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
    const zdt = zonedDateTimeFrom(zoned);
    return getWeekNumber(zdt.toPlainDate().toString(), weekStartsOn);
  } catch {
    return null;
  }
}
