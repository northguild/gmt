/**
 * Return true if `start` and `end` form a valid Unix interval — both finite numbers
 * and `start <= end`.
 *
 * - Both inputs must be numbers (or numeric strings that coerce to finite numbers).
 * - Equal `start === end` is valid.
 * - Non-finite values (NaN, Infinity) return `false`.
 *
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
 * @returns true if start and end form a valid Unix interval, or false on invalid input
 *
 * @example isValidUnixInterval(0, 1700000000) // true
 * @example isValidUnixInterval(1000, 1000) // true
 * @example isValidUnixInterval(1700000000, 0) // false
 * @example isValidUnixInterval("0", "1700000000") // true
 */
export function isValidUnixInterval(
  start: number | string,
  end: number | string,
): boolean {
  if (typeof start !== "number" && typeof start !== "string") {
    return false;
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return false;
  }

  const n1 = typeof start === "number" ? start : Number(start);
  const n2 = typeof end === "number" ? end : Number(end);

  if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
    return false;
  }

  return n1 <= n2;
}
