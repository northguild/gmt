import { parseUnixEpochValue } from "../../../internal";

/**
 * Return true if `start` and `end` form a valid Unix interval — both safe-integer epochs
 * and `start <= end`.
 *
 * - Each input must be a safe integer (`Number.isSafeInteger`) or a numeric string that coerces
 *   to one, exactly as every `unix/interval` function reads its arguments.
 * - Fractional values, `NaN`, `±Infinity` and anything beyond ±(2^53 − 1) return `false`.
 * - An empty or whitespace-only string returns `false` rather than reading as epoch 0.
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
