import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the hour (0-23) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "hour".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA; omitted means the system (host) time zone)
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromUnix(1700000000000, { timeZone: "UTC" }) // "22"
 * @example parseHourFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "00"
 * @example parseHourFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseHourFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "hour", options);
}
