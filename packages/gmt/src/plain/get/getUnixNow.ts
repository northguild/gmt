import { Temporal } from "@js-temporal/polyfill";
import { isValidUnixUnit, type UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the current Unix timestamp in either seconds or milliseconds.
 *
 * - Pass the optional unit `"seconds"` to receive seconds; defaults to
 *   milliseconds when omitted.
 * - Returns `null` for invalid unit input.
 *
 * @param unit optional unit specifier: "seconds" | "milliseconds"
 * @returns number (unix timestamp) or null on invalid unit
 */
export function getUnixNow(...unitInput: [unit?: UnixUnit]): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  const instant = Temporal.Now.instant();
  if (resolvedUnit === "seconds") {
    return Math.floor(instant.epochMilliseconds / 1000);
  }
  return instant.epochMilliseconds;
}
