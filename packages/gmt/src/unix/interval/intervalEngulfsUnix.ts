/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Compares numeric Unix epoch values directly.
 * - Equivalent to 4-argument `intervalContainsUnix(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (non-numeric types, non-finite values).
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — outer interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — outer interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — inner interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — inner interval end
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

  return n1 <= n3 && n4 <= n2;
}
