import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the symmetric difference of two Unix intervals — time covered by exactly one interval.
 *
 * - Compares numeric Unix epoch values directly.
 * - Endpoints are inclusive, so a returned piece ends one epoch unit before, or starts
 *   one epoch unit after, the interval it borders.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input: non-numeric types, empty strings, and values that are not safe
 *   integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)), where "one unit before/after"
 *   has no meaning.
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorUnix(0, 1500000000, 1400000000, 1700000000) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorUnix(0, 1700000000, 1400000000, 1500000000) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalXorUnix(NaN, 1500000000, 1400000000, 1700000000) // []
 * @example intervalXorUnix(0, 1, 0.5, 2) // [] (fractional epoch)
 */
export function intervalXorUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): Array<{ start: number; end: number }> {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return [];
  }

  const [a, b] = pair;

  // If intervals don't overlap, return both as-is
  if (a.end < b.start || b.end < a.start) {
    return [a, b];
  }

  const result: Array<{ start: number; end: number }> = [];

  // Left piece: A before B starts
  if (a.start < b.start) {
    result.push({ start: a.start, end: b.start - 1 });
  }

  // Right piece: A after B ends
  if (a.end > b.end) {
    result.push({ start: b.end + 1, end: a.end });
  }

  // Left piece: B before A starts
  if (b.start < a.start) {
    result.push({ start: b.start, end: a.start - 1 });
  }

  // Right piece: B after A ends
  if (b.end > a.end) {
    result.push({ start: a.end + 1, end: b.end });
  }

  return result;
}
