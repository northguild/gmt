import { Temporal } from "@js-temporal/polyfill";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../plain/validate/isValidUnixUnit";
import { plainDateTime } from "../../regex";

/**
 * Convert a UTC plain datetime string (no timezone suffix) to a unix epoch
 * value in milliseconds (default) or seconds.
 *
 * - Input must match the plain UTC datetime regex.
 * - Returns `null` for invalid inputs or invalid unit.
 *
 * @param value plain UTC datetime string (e.g. "2024-02-29T09:00:00")
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns epoch number or null when invalid
 */
export function convertUtcDateTimeToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!plainDateTime.test(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
    return null;
  }

  try {
    const milliseconds = Number(
      Temporal.Instant.from(`${value}Z`).epochMilliseconds,
    );

    return resolvedUnit === "seconds"
      ? Math.floor(milliseconds / 1000)
      : milliseconds;
  } catch {
    return null;
  }
}
