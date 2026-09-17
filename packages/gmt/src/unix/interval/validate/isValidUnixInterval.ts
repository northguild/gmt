import { parseUnixEpochValue } from "../../../internal";

/**
 * Return true if `start` and `end` form a valid Unix interval — both safe-integer epochs
 * and `start <= end`.
 *
 * - Each input must be a safe integer (`Number.isSafeInteger`) or a string of optionally negative
 *   ASCII digits naming one — the epoch grammar every `unix/` function shares.
 * - Fractional values, `NaN`, `±Infinity` and anything beyond ±(2^53 − 1) return `false`.
 * - Strings with whitespace, `+`, a decimal point, an exponent or hex digits return `false`, and an
 *   empty string is not epoch 0.
 * - Equal `start === end` is valid.
 *
 * @param start Unix epoch value, in the one unit all epoch arguments share — interval start
 * @param end Unix epoch value, in the one unit all epoch arguments share — interval end
 * @returns true if start and end form a valid Unix interval, or false on invalid input
 *
 * @example isValidUnixInterval(0, 1700000000) // true
 * @example isValidUnixInterval(1000, 1000) // true
 * @example isValidUnixInterval("0", "1700000000") // true
 * @example isValidUnixInterval(1700000000, 0) // false (reversed)
 * @example isValidUnixInterval(0, 1.5) // false (fractional)
 * @example isValidUnixInterval("", 1000) // false (empty string is not epoch 0)
 * @example isValidUnixInterval("0", " 1000") // false (a padded string is not an epoch)
 */
export function isValidUnixInterval(
  start: number | string,
  end: number | string,
): boolean {
  const startValue = parseUnixEpochValue(start);
  const endValue = parseUnixEpochValue(end);

  if (startValue === null || endValue === null) {
    return false;
  }

  return startValue <= endValue;
}
