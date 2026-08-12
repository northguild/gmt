/**
 * Return the overlapping span of two Unix epoch intervals, or null when they do not overlap.
 *
 * - Compares numeric Unix epoch values directly.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (non-numeric types, non-finite values).
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionUnix(0, 1700000000, 1000000, 2000000) // { start: 1000000, end: 1700000000 }
 * @example intervalIntersectionUnix(0, 1000000, 1000000, 2000000) // { start: 1000000, end: 1000000 }
 * @example intervalIntersectionUnix(0, 1000000, 1000001, 2000000) // null
 * @example intervalIntersectionUnix(NaN, 1700000000, 1000000, 2000000) // null
 * @example intervalIntersectionUnix("0", "1700000000", "1000000", "2000000") // { start: 1000000, end: 1700000000 }
 */
export function intervalIntersectionUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): { start: number; end: number } | null {
  if (typeof aStart !== "number" && typeof aStart !== "string") {
    return null;
  }

  if (typeof aEnd !== "number" && typeof aEnd !== "string") {
    return null;
  }

  if (typeof bStart !== "number" && typeof bStart !== "string") {
    return null;
  }

  if (typeof bEnd !== "number" && typeof bEnd !== "string") {
    return null;
  }

  const a1 = typeof aStart === "number" ? aStart : Number(aStart);
  const a2 = typeof aEnd === "number" ? aEnd : Number(aEnd);
  const b1 = typeof bStart === "number" ? bStart : Number(bStart);
  const b2 = typeof bEnd === "number" ? bEnd : Number(bEnd);

  if (
    !Number.isFinite(a1) ||
    !Number.isFinite(a2) ||
    !Number.isFinite(b1) ||
    !Number.isFinite(b2)
  ) {
    return null;
  }

  if (a1 > a2) {
    return null;
  }

  if (b1 > b2) {
    return null;
  }

  if (a2 < b1 || b2 < a1) {
    return null;
  }

  return {
    start: Math.max(a1, b1),
    end: Math.min(a2, b2),
  };
}
