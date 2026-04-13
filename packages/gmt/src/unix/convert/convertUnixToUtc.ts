import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidUnixUnit, type UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Convert a unix epoch value to a UTC Instant ISO string.
 *
 * - `value` is numeric milliseconds (default) or seconds when `unit` is "seconds".
 * - Returns empty string "" for invalid inputs.
 *
 * @param value epoch value (number)
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns UTC Instant string or empty string when invalid
 */
export function convertUnixToUtc(
  value: number,
  ...unitInput: [unit?: UnixUnit]
): string {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isValidAmount(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
    return "";
  }

  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(
      resolvedUnit === "seconds" ? value * 1000 : value,
    );

    return instant.toString();
  } catch {
    return "";
  }
}
