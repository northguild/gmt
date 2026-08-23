import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the month (1-12) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "month".
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
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "month", options);
}
