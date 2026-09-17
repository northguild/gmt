import { Temporal } from "@js-temporal/polyfill";
import {
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC Instant string to a unix epoch value in milliseconds or seconds.
 *
 * - Uses Temporal.Instant.from to parse.
 * - Seconds floor toward −∞, so `"1969-12-31T23:59:59.5Z"` is second `-1` (POSIX `time_t`).
 * - `options.epochUnit` is `"seconds"` or `"milliseconds"` (singular accepted), default
 *   `"milliseconds"`. An explicit `undefined` is the same as omitted; a non-object `options` (such
 *   as a bare `"seconds"` string) returns null.
 * - Returns null for invalid input.
 *
 * @param value UTC Instant string
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns epoch number or null on invalid
 *
 * @example convertUtcToUnix("2024-02-29T00:00:00Z") // 1709164800000
 * @example convertUtcToUnix("2024-02-29T00:00:00Z", { epochUnit: "seconds" }) // 1709164800
 * @example convertUtcToUnix("1969-12-31T23:59:59.5Z", { epochUnit: "second" }) // -1
 * @example convertUtcToUnix("2024-02-29T00:00:00Z", "seconds" as never) // null (options must be an object)
 * @example convertUtcToUnix("invalid") // null
 */
export function convertUtcToUnix(
  value: string,
  options?: { epochUnit?: UnixUnit },
): number | null {
  const epochUnit = resolveUnixEpochUnitOptions(options);

  if (!isValidUtc(value) || epochUnit === null) {
    return null;
  }

  try {
    return toUnixEpoch(Temporal.Instant.from(value), epochUnit);
  } catch {
    return null;
  }
}
