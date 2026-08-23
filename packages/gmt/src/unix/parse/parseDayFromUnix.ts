import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the day of month (1-31) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "day".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromUnix(1700000000000) // "15"
 * @example parseDayFromUnix(-86400, { epochUnit: "seconds" }) // "31"
 */
export function parseDayFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "day", options);
}
