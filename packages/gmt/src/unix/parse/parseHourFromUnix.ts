import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the hour (0-23) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "hour".
 * - `value` is a safe integer or a digit string; an omitted `timeZone` is UTC.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
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
  if (!isOptionsArgument(options)) {
    return "";
  }

  return parseUnitFromUnix(value, "hour", options);
}
