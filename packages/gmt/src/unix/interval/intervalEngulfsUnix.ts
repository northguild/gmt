import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Compares numeric Unix epoch values directly.
 * - Endpoints are inclusive: B may start at A's start and end at A's end.
 * - Equivalent to 4-argument `intervalContainsUnix(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — outer interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — outer interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — inner interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsUnix(0, 1700000000, 1500000000, 1600000000) // true
 * @example intervalEngulfsUnix(0, 1700000000, 0, 1700000000) // true (equal intervals)
 * @example intervalEngulfsUnix(0, 1700000000, 0, 1500000000) // true
 * @example intervalEngulfsUnix(1500000000, 1600000000, 0, 1700000000) // false
 * @example intervalEngulfsUnix(NaN, 1700000000, 1500000000, 1600000000) // false
 */
export function intervalEngulfsUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  // B's start and end both fall inside A.
  return (
    pair !== null &&
    pair[0].start <= pair[1].start &&
    pair[1].end <= pair[0].end
  );
}
