import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the millisecond (0-999) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "millisecond".
 * - `value` is a safe integer or a digit string; an omitted `timeZone` is UTC.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromUnix(1700000000000) // "000"
 * @example parseMillisecondFromUnix(-86400, { epochUnit: "seconds" }) // "000"
 * @example parseMillisecondFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseMillisecondFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  return parseUnitFromUnix(value, "millisecond", options);
}
