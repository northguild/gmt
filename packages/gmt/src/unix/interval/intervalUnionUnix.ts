import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the combined span of two Unix epoch intervals, or null when they are disjoint.
 *
 * - Compares numeric Unix epoch values directly.
 * - Overlapping intervals return their merged span.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionUnix(0, 1700000000, 1000000, 2000000) // { start: 0, end: 1700000000 }
 * @example intervalUnionUnix(0, 1000000, 1000000, 2000000) // { start: 0, end: 2000000 }
 * @example intervalUnionUnix(0, 1000000, 1000001, 2000000) // null
 * @example intervalUnionUnix(NaN, 1700000000, 1000000, 2000000) // null
 * @example intervalUnionUnix("0", "1700000000", "1000000", "2000000") // { start: 0, end: 1700000000 }
 */
export function intervalUnionUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): { start: number; end: number } | null {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return null;
  }

  const [a, b] = pair;

  // Disjoint intervals have no single combined span.
  if (Math.max(a.start, b.start) > Math.min(a.end, b.end)) {
    return null;
  }

  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}
