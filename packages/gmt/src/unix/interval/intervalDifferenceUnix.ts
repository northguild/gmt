import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Compares numeric Unix epoch values directly.
 * - Endpoints are inclusive, so a returned piece ends one epoch unit before, or starts
 *   one epoch unit after, the interval it borders.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input: non-numeric types, empty strings, and values that are not safe
 *   integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)), where "one unit before" has no
 *   meaning.
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceUnix(0, 1700000000, 1500000000, 1600000000) // [{ start: 0, end: 1499999999 }, { start: 1600000001, end: 1700000000 }]
 * @example intervalDifferenceUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalDifferenceUnix(NaN, 1700000000, 1500000000, 1600000000) // []
 * @example intervalDifferenceUnix(0, 2, 0.5, 1) // [] (fractional epoch)
 * @example intervalDifferenceUnix(5, 10, 0, 2) // [{ start: 5, end: 10 }] (B entirely before A)
 */
export function intervalDifferenceUnix(
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

  // The part of A before B starts, and the part after B ends — each clipped to A, so a B lying
  // entirely before or after A leaves A whole.
  const pieces = [
    { start: a.start, end: Math.min(a.end, b.start - 1) },
    { start: Math.max(a.start, b.end + 1), end: a.end },
  ];

  return pieces.filter((piece) => piece.start <= piece.end);
}
