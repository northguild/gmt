import {
  isObject,
  isOptionsArgument,
  parseUnixEpochValue,
} from "../../internal";

/**
 * Return true if `value1` and `value2` form a valid Unix range — both safe-integer epochs
 * and `value1 < value2` (or `<=` with `allowEqual`).
 *
 * - Each input must be a safe integer (`Number.isSafeInteger`) or a string of optionally negative
 *   ASCII digits naming one — the epoch grammar every `unix/` function shares.
 * - Fractional values, `NaN`, `±Infinity` and anything beyond ±(2^53 − 1) return `false`.
 * - Strings with whitespace, `+`, a decimal point, an exponent or hex digits return `false`, and an
 *   empty string is not epoch 0.
 * - Equal `value1 === value2` is valid only when `options.allowEqual` is true.
 *
 * @param value1 first Unix epoch value (seconds or milliseconds)
 * @param value2 second Unix epoch value (seconds or milliseconds)
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the Unix range is valid
 *
 * @example isValidUnixRange({ value1: 0, value2: 1700000000 }) // true
 * @example isValidUnixRange({ value1: 1000, value2: 1000, options: { allowEqual: true } }) // true
 * @example isValidUnixRange({ value1: 1700000000, value2: 0 }) // false (reversed)
 * @example isValidUnixRange({ value1: 0, value2: 1.5 }) // false (fractional)
 * @example isValidUnixRange({ value1: "", value2: 1000 }) // false (empty string is not epoch 0)
 * @example isValidUnixRange({ value1: "0", value2: "1e3" }) // false (exponent notation is not an epoch)
 */
export function isValidUnixRange(props: {
  value1: number | string;
  value2: number | string;
  options?: { allowEqual?: boolean };
}): boolean {
  try {
    if (!isObject(props)) return false;
    const { value1, value2, options } = props;
    if (!isOptionsArgument(options)) return false;

    const first = parseUnixEpochValue(value1);
    const second = parseUnixEpochValue(value2);

    if (first === null || second === null) {
      return false;
    }

    return options?.allowEqual ? first <= second : first < second;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
