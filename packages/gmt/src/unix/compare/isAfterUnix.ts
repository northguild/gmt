import { compareUnixEpochs } from "../../internal/compareUnixEpochs";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return whether `value1` represents an instant strictly after `value2`.
 *
 * - Uses Temporal.Instant.compare to check ordering.
 * - Each value is a safe integer or a string of optionally negative ASCII digits; anything else
 *   is invalid.
 * - Returns false if either input is invalid.
 *
 * @param value1 first unix epoch: a safe integer or a digit string
 * @param value2 second unix epoch, in the same unit
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns `true` if `value1` is after `value2`, otherwise `false`
 *
 * @example isAfterUnix(1706659200, 1704067200) // true
 * @example isAfterUnix(1706659200, 1706659200) // false
 * @example isAfterUnix(-1, 0) // false
 * @example isAfterUnix("1706659200", "1704067200") // true (digit strings)
 * @example isAfterUnix(" 1706659200", 1704067200) // false (a padded string is not an epoch)
 */
export function isAfterUnix(
  value1: number | string,
  value2: number | string,
  options?: { epochUnit?: UnixUnit },
): boolean {
  try {
    if (!isOptionsArgument(options)) {
      return false;
    }

    const order = compareUnixEpochs(value1, value2, options);

    return order !== null && order === 1;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
