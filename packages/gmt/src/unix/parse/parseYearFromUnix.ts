import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the year from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "year".
 * - `value` is a safe integer or a digit string; an omitted `timeZone` is UTC.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromUnix(1700000000000) // "2023"
 * @example parseYearFromUnix(1704067200000, { epochUnit: "milliseconds", timeZone: "UTC" }) // "2024"
 * @example parseYearFromUnix(-86400, { epochUnit: "seconds" }) // "1969"
 * @example parseYearFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseYearFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  return parseUnitFromUnix(value, "year", options);
}
