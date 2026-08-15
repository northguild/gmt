/**
 * Return the symmetric difference of two Unix intervals — time covered by exactly one interval.
 *
 * - Compares numeric Unix epoch values directly.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (non-numeric types, non-finite values).
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorUnix(0, 1500000000, 1400000000, 1700000000) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorUnix(0, 1700000000, 1400000000, 1500000000) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalXorUnix(NaN, 1500000000, 1400000000, 1700000000) // []
 */
export function intervalXorUnix(
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

  // If intervals don't overlap, return both as-is
  if (n2 < n3 || n4 < n1) {
    return [
      { start: n1, end: n2 },
      { start: n3, end: n4 },
    ];
  }

  // Left piece: A before B starts
  if (n1 < n3) {
    result.push({ start: n1, end: n3 - 1 });
  }

  // Right piece: A after B ends
  if (n2 > n4) {
    result.push({ start: n4 + 1, end: n2 });
  }

  // Left piece: B before A starts
  if (n3 < n1) {
    result.push({ start: n3, end: n1 - 1 });
  }

  // Right piece: B after A ends
  if (n4 > n2) {
    result.push({ start: n2 + 1, end: n4 });
  }

  return result;
}
