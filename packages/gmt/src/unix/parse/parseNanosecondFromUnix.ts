import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the nanosecond (0-999) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "nanosecond".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromUnix(1700000000000) // "000000000"
 * @example parseNanosecondFromUnix(-86400, { epochUnit: "seconds" }) // "000000000"
 */
export function parseNanosecondFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "nanosecond", options);
}
