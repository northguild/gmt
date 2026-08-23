import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the millisecond (0-999) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "millisecond".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromUnix(1700000000000) // "000"
 * @example parseMillisecondFromUnix(-86400, { epochUnit: "seconds" }) // "000"
 */
export function parseMillisecondFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "millisecond", options);
}
