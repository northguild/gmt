import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the overlapping span of two Unix epoch intervals, or null when they do not overlap.
 *
 * - Compares numeric Unix epoch values directly.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionUnix(0, 1700000000, 1000000, 2000000) // { start: 1000000, end: 2000000 }
 * @example intervalIntersectionUnix(0, 1000000, 1000000, 2000000) // { start: 1000000, end: 1000000 }
 * @example intervalIntersectionUnix(0, 1000000, 1000001, 2000000) // null
 * @example intervalIntersectionUnix(NaN, 1700000000, 1000000, 2000000) // null
 * @example intervalIntersectionUnix("0", "1700000000", "1000000", "2000000") // { start: 1000000, end: 2000000 }
 */
export function intervalIntersectionUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): { start: number; end: number } | null {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);
  const start = pair && Math.max(pair[0].start, pair[1].start);
  const end = pair && Math.min(pair[0].end, pair[1].end);

  // The latest start and earliest end bound the overlap; there is none when they cross.
  return start === null || end === null || start > end ? null : { start, end };
}
