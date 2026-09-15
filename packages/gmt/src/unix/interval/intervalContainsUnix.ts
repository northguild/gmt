import { parseUnixEpochInterval, parseUnixEpochValue } from "../../internal";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Compares numeric Unix epoch values directly.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param intervalStart Unix epoch value (seconds or milliseconds) — outer interval start
 * @param intervalEnd Unix epoch value (seconds or milliseconds) — outer interval end
 * @param pointOrStart Unix epoch value for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional Unix epoch value for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsUnix(0, 1700000000, 170000000) // true
 * @example intervalContainsUnix(0, 1700000000, 170000000, 1500000000) // true
 * @example intervalContainsUnix(1700000000, 0, 170000000) // false
 * @example intervalContainsUnix(0, 1700000000, 170000000, 15000000) // false
 * @example intervalContainsUnix(NaN, 1700000000, 170000000) // false
 * @example intervalContainsUnix("0", "1700000000", "170000000") // true
 * @example intervalContainsUnix(0, 10, 0.5) // false (fractional epoch)
 */
export function intervalContainsUnix(
  intervalStart: number | string,
  intervalEnd: number | string,
  pointOrStart: number | string,
  pointEnd?: number | string,
): boolean {
  const outer = parseUnixEpochInterval(intervalStart, intervalEnd);

  if (outer === null) {
    return false;
  }

  if (pointEnd === undefined) {
    const point = parseUnixEpochValue(pointOrStart);
    return point !== null && outer.start <= point && point <= outer.end;
  }

  const inner = parseUnixEpochInterval(pointOrStart, pointEnd);

  return inner !== null && outer.start <= inner.start && inner.end <= outer.end;
}
