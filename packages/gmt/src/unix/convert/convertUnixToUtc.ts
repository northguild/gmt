import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidUnixUnit, type UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Convert a unix epoch value to a UTC Instant ISO string.
 *
 * - Converts to UTC Instant using Temporal.Instant.
 * - Validates value and epoch unit ("seconds" | "milliseconds").
 * - Returns "" for invalid input.
 *
 * @param value epoch value (number)
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns UTC Instant string or "" on invalid
 *
 * @example convertUnixToUtc(1709164800000) // "2024-02-29T00:00:00Z"
 * @example convertUnixToUtc(1709164800, "seconds") // "2024-02-29T00:00:00Z"
 * @example convertUnixToUtc(-1) // "1969-12-31T23:59:59.999Z"
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
