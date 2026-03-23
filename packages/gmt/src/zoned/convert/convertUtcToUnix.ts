import { Temporal } from "@js-temporal/polyfill";
import { isUtcDateTime } from "../../plain/validate/isUtcDateTime";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../plain/validate/isValidUnixUnit";

/**
 * Convert a UTC Instant string to a unix epoch value in milliseconds or
 * seconds.
 *
 * - Returns `null` for invalid inputs or unit.
 *
 * @param value UTC Instant string
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns epoch number or null when invalid
 */
export function convertUtcToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isUtcDateTime(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  try {
    const milliseconds = Number(Temporal.Instant.from(value).epochMilliseconds);

    return resolvedUnit === "seconds"
      ? Math.floor(milliseconds / 1000)
      : milliseconds;
  } catch {
    return null;
  }
}
