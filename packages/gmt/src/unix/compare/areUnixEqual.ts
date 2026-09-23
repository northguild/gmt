import { compareUnixEpochs } from "../../internal/compareUnixEpochs";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return whether `value1` and `value2` represent the same instant.
 *
 * - Uses Temporal.Instant.compare to check equality.
 * - Each value is a safe integer or a string of optionally negative ASCII digits; anything else
 *   is invalid.
 * - Returns false if either input is invalid.
 *
 * @param value1 first unix epoch: a safe integer or a digit string
 * @param value2 second unix epoch, in the same unit
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds")
 * @returns `true` if `value1` and `value2` are equal, otherwise `false`
 *
 * @example areUnixEqual(1706659200, 1706659200) // true
 * @example areUnixEqual(1706659200, 1704067200) // false
 * @example areUnixEqual(1706659200, 1706659200000, { epochUnit: "seconds" }) // false (epochUnit applies to both values)
 * @example areUnixEqual(1706659200, 1706659200000) // false
 * @example areUnixEqual(-86400000, 0) // false (1969-12-31 is not equal to 1970-01-01)
 * @example areUnixEqual("1706659200", 1706659200, { epochUnit: "second" }) // true (a digit string is the same epoch)
 * @example areUnixEqual("1706659200.0", 1706659200) // false (not a digit string)
 */
export function areUnixEqual(
  value1: number | string,
  value2: number | string,
  options?: { epochUnit?: UnixUnit },
): boolean {
  try {
    if (!isOptionsArgument(options)) {
      return false;
    }

    const order = compareUnixEpochs(value1, value2, options);

    return order !== null && order === 0;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
