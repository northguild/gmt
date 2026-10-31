import { Temporal } from "../../internal/temporal";
import {
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the current Unix timestamp in either seconds or milliseconds.
 *
 * - Uses Temporal.Now.instant() to get current time.
 * - An explicit `undefined` is the same as omitted. Options outside the type, an unknown
 *   `epochUnit` or a non-object such as a bare `"seconds"`, return null.
 * - Options whose `epochUnit` throws when read, such as a getter or a `Proxy`, also return null.
 *
 * @param options optional: the unit of the result
 * @returns the current Unix timestamp; null for options outside the type or options that throw
 *   when read
 *
 * @example getUnixNow() // 1700000000000
 * @example getUnixNow({ epochUnit: "seconds" }) // 1700000000
 * @example getUnixNow({ epochUnit: "minutes" }) // null (not a UnixUnit)
 * @example getUnixNow("seconds") // null (options must be an object)
 */
export function getUnixNow(options?: {
  /**
   * The unit of the returned epoch: `"seconds"` or `"milliseconds"`, singular or plural. Seconds
   * floor toward −∞, as POSIX `time_t` counts whole elapsed seconds. Any other value is outside
   * the type and returns `null`.
   *
   * @defaultValue `"milliseconds"`
   */
  epochUnit?: UnixUnit;
}): number;
export function getUnixNow(options?: unknown): number | null;
export function getUnixNow(options?: unknown): number | null {
  try {
    const epochUnit = resolveUnixEpochUnitOptions(options);

    if (epochUnit === null) {
      return null;
    }

    return toUnixEpoch(Temporal.Now.instant(), epochUnit);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
