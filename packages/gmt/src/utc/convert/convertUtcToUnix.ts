import { Temporal } from "@js-temporal/polyfill";
import {
  isValidUnixUnit,
  type UnixUnit,
} from "../../unix/validate/isValidUnixUnit";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC Instant string to a unix epoch value in milliseconds or seconds.
 *
 * - Uses Temporal.Instant.from to parse.
 * - Validates unit ("seconds" | "milliseconds").
 * - Returns null for invalid input.
 *
 * @param value UTC Instant string
 * @param unit optional unit, "seconds" or "milliseconds"
 * @returns epoch number or null on invalid
 *
 * @example convertUtcToUnix("2024-02-29T00:00:00Z") // 1709164800000
 * @example convertUtcToUnix("2024-02-29T00:00:00Z", "seconds") // 1709164800
 * @example convertUtcToUnix("invalid") // null
 */
export function convertUtcToUnix(
  value: string,
  ...unitInput: [unit?: UnixUnit]
): number | null {
  const resolvedUnit = unitInput.length === 0 ? "milliseconds" : unitInput[0];

  if (!isValidUtc(value) || !isValidUnixUnit(resolvedUnit ?? "")) {
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
