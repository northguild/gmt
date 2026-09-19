import { halfOpenAbuts, parseUnixEpochInterval } from "../../internal";

/**
 * Return true when two half-open Unix intervals `[start, end)` are exactly adjacent — one ends
 * where the other starts, so they share no value and leave no gap (Allen's "meets", either order).
 *
 * - Compares numeric Unix epoch values directly.
 * - Returns `true` when `aEnd === bStart` or `bEnd === aStart` and neither interval is empty. No
 *   value is stepped by an epoch unit.
 * - Returns `false` when intervals overlap, are disjoint with a gap (even one epoch unit), or when
 *   either is empty (`start === end`): an empty interval abuts nothing.
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsUnix(0, 1500000000, 1500000000, 1700000000) // true
 * @example intervalAbutsUnix(1500000000, 1700000000, 0, 1500000000) // true
 * @example intervalAbutsUnix(0, 1500000000, 1500000001, 1700000000) // false (one-unit gap)
 * @example intervalAbutsUnix(0, 1500000000, 1500000000, 1500000000) // false (an empty interval abuts nothing)
 * @example intervalAbutsUnix(0, 1500000001, 1500000000, 1700000000) // false (overlap)
 * @example intervalAbutsUnix(NaN, 1500000000, 1500000001, 1700000000) // false
 * @example intervalAbutsUnix(0, 1.5, 1.5, 3) // false (fractional epochs)
 */
export function intervalAbutsUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  const a = parseUnixEpochInterval(aStart, aEnd);
  const b = parseUnixEpochInterval(bStart, bEnd);

  if (a === null || b === null) {
    return false;
  }

  // aEnd === bStart, or bEnd === aStart, between two non-empty intervals.
  return halfOpenAbuts(a, b, (left, right) => left - right);
}
