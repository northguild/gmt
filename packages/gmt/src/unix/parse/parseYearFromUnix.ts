import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";

/**
 * Return the year from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "year".
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds (number or string)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA)
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromUnix(1700000000000) // "2023"
 * @example parseYearFromUnix(1704067200000, { epochUnit: "milliseconds" }) // "2024"
 * @example parseYearFromUnix(-86400, { epochUnit: "seconds" }) // "1969"
 */
export function parseYearFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  return parseUnitFromUnix(value, "year", options);
}
