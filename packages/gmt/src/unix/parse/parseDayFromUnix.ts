import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of month (1-31) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "day".
 * - `value` is a safe integer or a digit string; an omitted `timeZone` is UTC.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromUnix(1700000000000, { timeZone: "UTC" }) // "14"
 * @example parseDayFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "31"
 * @example parseDayFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseDayFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  return parseUnitFromUnix(value, "day", options);
}
