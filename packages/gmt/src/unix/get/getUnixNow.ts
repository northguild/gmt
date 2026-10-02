import { Temporal } from "@js-temporal/polyfill";
import {
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the current Unix timestamp in either seconds or milliseconds.
 *
 * - Uses Temporal.Now.instant() to get current time.
 * - An explicit `undefined` is the same as omitted. An unknown `epochUnit`, or a non-object
 *   `options` (such as a bare `"seconds"` string), returns null.
 *
 * @param options optional: the unit of the result
 * @returns the current unix timestamp, or null on invalid options
 *
 * @example getUnixNow() // 1700000000000
 * @example getUnixNow({ epochUnit: "seconds" }) // 1700000000
 * @example getUnixNow({ epochUnit: "minutes" as never }) // null
 * @example getUnixNow("seconds" as never) // null (options must be an object)
 */
export function getUnixNow(options?: {
  /**
   * The unit of the returned epoch: `"seconds"` or `"milliseconds"`, singular or plural. Seconds
   * floor toward −∞, as POSIX `time_t` counts whole elapsed seconds. Any other value returns null.
   *
   * @defaultValue `"milliseconds"`
   */
  epochUnit?: UnixUnit;
}): number | null {
  try {
    const epochUnit = resolveUnixEpochUnitOptions(options);

    if (epochUnit === null) {
      return null;
    }

    try {
      return toUnixEpoch(Temporal.Now.instant(), epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
