import { parseUnixEpochInterval } from "../../internal";

/**
 * Return true when two Unix intervals are exactly adjacent — one's end is one epoch unit before
 * the other's start, so they share no value and leave no gap.
 *
 * - Compares numeric Unix epoch values directly.
 * - Returns `true` when `aEnd + 1 === bStart` or `bEnd + 1 === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)), where "one unit apart" has
 *   no meaning.
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsUnix(0, 1500000000, 1500000001, 1700000000) // true
 * @example intervalAbutsUnix(1500000001, 1700000000, 0, 1500000000) // true
 * @example intervalAbutsUnix(0, 1500000000, 1500000002, 1700000000) // false (gap)
 * @example intervalAbutsUnix(0, 1500000001, 1500000000, 1700000000) // false (overlap)
 * @example intervalAbutsUnix(NaN, 1500000000, 1500000001, 1700000000) // false
 * @example intervalAbutsUnix(0, 1.5, 2.5, 3) // false (fractional epochs)
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

  // aEnd + 1 === bStart, or bEnd + 1 === aStart
  return a.end + 1 === b.start || b.end + 1 === a.start;
}
