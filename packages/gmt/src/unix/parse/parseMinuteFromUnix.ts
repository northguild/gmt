import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the minute (0-59) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "minute".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromUnix(1700000000000) // "26"
 * @example parseMinuteFromUnix(-86400, { epochUnit: "seconds" }) // "00"
 */
export function parseMinuteFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "minute", options);
}
