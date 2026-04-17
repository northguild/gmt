import { Temporal } from "@js-temporal/polyfill";
import { isValidUnixUnit, type UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the current Unix timestamp in either seconds or milliseconds.
 *
 * - Uses Temporal.Now.instant() to get current time.
 * - Defaults to "milliseconds" if no unit specified.
 * - Returns 0 on failure.
 *
 * @param unit optional unit specifier: "seconds" | "milliseconds"
 * @returns number (unix timestamp)
 *
 * @example getUnixNow() // 1700000000000
 * @example getUnixNow("seconds") // 1700000000
 */
export function getUnixNow(...unitInput: [unit?: UnixUnit]): number {
  const rawUnit = unitInput.length === 0 ? undefined : unitInput[0];
  const resolvedUnit: UnixUnit =
    unitInput.length === 0
      ? "milliseconds"
      : isValidUnixUnit(String(rawUnit ?? ""))
        ? (rawUnit as UnixUnit)
        : "milliseconds";

  const instant = Temporal.Now.instant();
  if (resolvedUnit === "seconds") {
    return Math.floor(instant.epochMilliseconds / 1000);
  }
  return instant.epochMilliseconds;
}
