/**
 * Return true if `value1` and `value2` form a valid Unix range — both finite numbers
 * and `value1 <= value2`.
 *
 * - Both inputs must be numbers (or numeric strings that coerce to finite numbers).
 * - Equal `value1 === value2` is valid when `options.allowEqual` is true.
 * - Non-finite values (NaN, Infinity) return `false`.
 *
 * @param value1 first Unix epoch value (seconds or milliseconds)
 * @param value2 second Unix epoch value (seconds or milliseconds)
 * @param options optional allowEqual flag
 * @returns boolean indicating whether the Unix range is valid
 *
 * @example isValidUnixRange({ value1: 0, value2: 1700000000 }) // true
 * @example isValidUnixRange({ value1: 1700000000, value2: 0 }) // false
 * @example isValidUnixRange({ value1: 1000, value2: 1000, options: { allowEqual: true } }) // true
 */
export function isValidUnixRange({
  value1,
  value2,
  options,
}: {
  value1: number | string;
  value2: number | string;
  options?: { allowEqual?: boolean };
}): boolean {
  if (typeof value1 !== "number" && typeof value1 !== "string") {
    return false;
  }

  if (typeof value2 !== "number" && typeof value2 !== "string") {
    return false;
  }

  const n1 = typeof value1 === "number" ? value1 : Number(value1);
  const n2 = typeof value2 === "number" ? value2 : Number(value2);

  if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
    return false;
  }

  if (options?.allowEqual) {
    return n1 <= n2;
  }

  return n1 < n2;
}
