import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the microsecond (0-999) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "microsecond".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromUnix(1700000000000) // "000"
 * @example parseMicrosecondFromUnix(-86400, { epochUnit: "seconds" }) // "000"
 */
export function parseMicrosecondFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "microsecond", options);
}
