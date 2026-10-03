import {
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../../unix/validate/isValidUnixUnit";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Convert an ISO 8601 zoned datetime string to a unix epoch value in milliseconds (default) or seconds.
 *
 * - Uses Temporal.ZonedDateTime.toInstant to convert.
 * - Seconds floor toward −∞, as POSIX `time_t` counts whole elapsed seconds.
 * - A non-object `options` (such as a bare `"seconds"` string) returns null.
 * - Returns null for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param options optional setting for the unit of the returned epoch value
 * @returns epoch number or null on invalid
 *
 * @example convertZonedToUnix("2024-02-29T12:34:56.789+00:00[UTC]") // 1709210096789
 * @example convertZonedToUnix("2024-02-29T12:34:56.789+00:00[UTC]", { epochUnit: "seconds" }) // 1709210096
 * @example convertZonedToUnix("2024-02-29T12:34:56.789+00:00[UTC]", "seconds" as never) // null (options must be an object)
 * @example convertZonedToUnix("invalid") // null
 */
export function convertZonedToUnix(
  value: string,
  options?: {
    /**
     * The unit the epoch value is returned in: `"milliseconds"` or `"seconds"`, each also accepted
     * in its singular form. An explicit `undefined` is the same as omitted; any other value returns
     * null.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
  },
): number | null {
  try {
    const epochUnit = resolveUnixEpochUnitOptions(options);

    if (!isValidZonedDateTime(value) || epochUnit === null) {
      return null;
    }

    try {
      return toUnixEpoch(zonedDateTimeFrom(value).toInstant(), epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
