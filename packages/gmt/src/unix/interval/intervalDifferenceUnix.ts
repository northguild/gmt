/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Compares numeric Unix epoch values directly.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (non-numeric types, non-finite values).
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceUnix(0, 1700000000, 1500000000, 1600000000) // [{ start: 0, end: 1499999999 }]
 * @example intervalDifferenceUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalDifferenceUnix(NaN, 1700000000, 1500000000, 1600000000) // []
 */
export function intervalDifferenceUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): Array<{ start: number; end: number }> {
  if (
    (typeof aStart !== "number" && typeof aStart !== "string") ||
    (typeof aEnd !== "number" && typeof aEnd !== "string") ||
    (typeof bStart !== "number" && typeof bStart !== "string") ||
    (typeof bEnd !== "number" && typeof bEnd !== "string")
  ) {
    return [];
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
    return [];
  }

  if (n1 > n2) {
    return [];
  }

  if (n3 > n4) {
    return [];
  }

  const result: Array<{ start: number; end: number }> = [];

  // Left piece: A before B starts
  if (n1 < n3) {
    const leftEnd = n2 < n3 ? n2 : n3 - 1;
    if (leftEnd >= n1) {
      result.push({ start: n1, end: leftEnd });
    }
  }

  // Right piece: A after B ends
  if (n2 > n4) {
    result.push({ start: n4 + 1, end: n2 });
  }

  return result;
}
