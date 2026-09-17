import { compareUnixEpochs } from "../../internal/compareUnixEpochs";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return whether `value1` represents an instant strictly before `value2`.
 *
 * - Uses Temporal.Instant.compare to check ordering.
 * - Each value is a safe integer or a string of optionally negative ASCII digits; anything else
 *   is invalid.
 * - Returns false if either input is invalid.
 *
 * @param value1 first unix epoch: a safe integer or a digit string
 * @param value2 second unix epoch, in the same unit
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns `true` if `value1` is before `value2`, otherwise `false`
 *
 * @example isBeforeUnix(1704067200, 1706659200) // true
 * @example isBeforeUnix(1706659200, 1706659200) // false
 * @example isBeforeUnix(-1, 0) // true (1969-12-31T23:59:59.999Z is before 1970-01-01T00:00:00Z)
 * @example isBeforeUnix('invalid', 1704067200000) // false
 * @example isBeforeUnix(1704067200000, 'invalid') // false
 * @example isBeforeUnix("-1", "0") // true (digit strings)
 */
export function isBeforeUnix(
  value1: number | string,
  value2: number | string,
  options?: { epochUnit?: UnixUnit },
): boolean {
  if (!isOptionsArgument(options)) {
    return false;
  }

  const order = compareUnixEpochs(value1, value2, options);

  return order !== null && order === -1;
}
