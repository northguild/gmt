import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { type UnixEpochUnit, unixEpochToInstant } from "./unixEpochValue";

/**
 * Resolve the `reference` option of the unix formatters to an instant.
 *
 * - Omitted: now.
 * - A string is a numeric unix epoch (`"1709164800000"`) or a UTC ISO string
 *   (`"2024-02-29T00:00:00Z"`). The numeric reading is tried first, matching `formatUnix`.
 * - A number is a unix epoch in `epochUnit`.
 *
 * @param reference the option as given
 * @param epochUnit the unit a numeric reference is read in
 * @returns the instant, or null when the reference is neither form or the clock is unavailable
 * @example resolveUnixFormatReference(1709164800, "seconds")?.toString() // "2024-02-29T00:00:00Z"
 * @example resolveUnixFormatReference("2024-02-29T00:00:00Z", "milliseconds")?.toString() // "2024-02-29T00:00:00Z"
 * @example resolveUnixFormatReference("yesterday", "milliseconds") // null
 */
export function resolveUnixFormatReference(
  reference: string | number | undefined,
  epochUnit: UnixEpochUnit,
): Temporal.Instant | null {
  if (reference === undefined) {
    try {
      return Temporal.Now.instant();
    } catch {
      return null;
    }
  }
  if (typeof reference !== "string") {
    return unixEpochToInstant(reference, epochUnit);
  }
  const numericRef = unixEpochToInstant(reference, epochUnit);
  if (numericRef !== null) {
    return numericRef;
  }
  if (!isValidUtc(reference)) {
    return null;
  }
  try {
    return Temporal.Instant.from(reference);
  } catch {
    return null;
  }
}
