import { Temporal } from "@js-temporal/polyfill";
import { isValidUnixUnit, type UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the current Unix timestamp in either seconds or milliseconds.
 *
 * - Pass the optional unit `"seconds"` to receive seconds; defaults to
 *   milliseconds when omitted or when an invalid unit is provided.
 * - This function never returns `null`; it falls back to `"milliseconds"`.
 *
 * @param unit optional unit specifier: "seconds" | "milliseconds"
 * @returns number (unix timestamp)
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
