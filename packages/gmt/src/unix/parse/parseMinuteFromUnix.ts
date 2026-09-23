import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the minute (0-59) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "minute".
 * - `value` is a safe integer or a digit string; an omitted `timeZone` is UTC.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromUnix(1700000000000, { timeZone: "UTC" }) // "13"
 * @example parseMinuteFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "00"
 * @example parseMinuteFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseMinuteFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    return parseUnitFromUnix(value, "minute", options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
