// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a Unix timestamp to a plain time string in the format "HH:mm:ss".
 *
 * - Converts to PlainTime in `timeZone`: omitted is UTC, `"local"` is the system zone, and an
 *   unknown zone returns "".
 * - `unix` is a safe integer or a string of optionally negative ASCII digits; anything else returns
 *   "".
 * - Validates epoch unit ("seconds" | "milliseconds", singular accepted).
 * - Returns "" for invalid input.
 *
 * @param unix Unix epoch: a safe integer or a digit string
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 *
 * @example convertUnixToPlainTime(1706659200000, { timeZone: "UTC" }) // "00:00:00"
 * @example convertUnixToPlainTime(1706659200, { epochUnit: "seconds", timeZone: "UTC" }) // "00:00:00"
 * @example convertUnixToPlainTime(-1, { timeZone: "UTC" }) // "23:59:59.999"
 * @example convertUnixToPlainTime("1706659200000", { timeZone: "local" }) // system-zone wall clock, e.g. "19:00:00" in America/New_York
 * @example convertUnixToPlainTime(NaN) // ""
 */
export function convertUnixToPlainTime(
  unix: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const timeZone = normalizeTimeZone(options?.timeZone);

    if (epochUnit === null || !timeZone) return "";

    const instant = unixEpochToInstant(unix, epochUnit);

    if (instant === null) return "";

    try {
      return instant.toZonedDateTimeISO(timeZone).toPlainTime().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
