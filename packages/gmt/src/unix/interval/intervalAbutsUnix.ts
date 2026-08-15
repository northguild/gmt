/**
 * Return true when two Unix intervals are exactly adjacent — one's end equals the other's
 * start minus 1 (no gap, no overlap).
 *
 * - Compares numeric Unix epoch values directly.
 * - Returns `true` when `aEnd + 1 === bStart` or `bEnd + 1 === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (non-numeric types, non-finite values).
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
 */
export function intervalAbutsUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  if (
    (typeof aStart !== "number" && typeof aStart !== "string") ||
    (typeof aEnd !== "number" && typeof aEnd !== "string") ||
    (typeof bStart !== "number" && typeof bStart !== "string") ||
    (typeof bEnd !== "number" && typeof bEnd !== "string")
  ) {
    return false;
  }

  const n1 = typeof aStart === "number" ? aStart : Number(aStart);
  const n2 = typeof aEnd === "number" ? aEnd : Number(aEnd);
  const n3 = typeof bStart === "number" ? bStart : Number(bStart);
  const n4 = typeof bEnd === "number" ? bEnd : Number(bEnd);

  if (
    !Number.isFinite(n1) ||
    !Number.isFinite(n2) ||
    !Number.isFinite(n3) ||
    !Number.isFinite(n4)
  ) {
    return false;
  }

  if (n1 > n2) {
    return false;
  }

  if (n3 > n4) {
    return false;
  }

  // aEnd + 1 === bStart
  if (n2 + 1 === n3) {
    return true;
  }

  // bEnd + 1 === aStart
  if (n4 + 1 === n1) {
    return true;
  }

  return false;
}
