/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Compares numeric Unix epoch values directly.
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (non-numeric types, non-finite values).
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapUnix(0, 1700000000, 1000000, 2000000) // true
 * @example intervalsOverlapUnix(0, 1000000, 1000000, 2000000) // false (adjacent)
 * @example intervalsOverlapUnix(0, 1000000, 1000001, 2000000) // false (disjoint)
 * @example intervalsOverlapUnix(NaN, 1700000000, 1000000, 2000000) // false
 * @example intervalsOverlapUnix("0", "1700000000", "1000000", "2000000") // true
 */
export function intervalsOverlapUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  if (typeof aStart !== "number" && typeof aStart !== "string") {
    return false;
  }

  if (typeof aEnd !== "number" && typeof aEnd !== "string") {
    return false;
  }

  if (typeof bStart !== "number" && typeof bStart !== "string") {
    return false;
  }

  if (typeof bEnd !== "number" && typeof bEnd !== "string") {
    return false;
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
    return false;
  }

  if (a1 > a2) {
    return false;
  }

  if (b1 > b2) {
    return false;
  }

  return a2 >= b1 && b2 >= a1;
}
