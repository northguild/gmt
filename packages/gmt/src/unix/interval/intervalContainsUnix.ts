/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Compares numeric Unix epoch values directly.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (non-numeric types, non-finite values).
 *
 * @param intervalStart Unix epoch value (seconds or milliseconds) — outer interval start
 * @param intervalEnd Unix epoch value (seconds or milliseconds) — outer interval end
 * @param pointOrStart Unix epoch value for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional Unix epoch value for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsUnix(0, 1700000000, 170000000) // true
 * @example intervalContainsUnix(0, 1700000000, 170000000, 1500000000) // true
 * @example intervalContainsUnix(1700000000, 0, 170000000) // false
 * @example intervalContainsUnix(0, 1700000000, 170000000, 15000000) // false
 * @example intervalContainsUnix(NaN, 1700000000, 170000000) // false
 * @example intervalContainsUnix("0", "1700000000", "170000000") // true
 */
export function intervalContainsUnix(
  intervalStart: number | string,
  intervalEnd: number | string,
  pointOrStart: number | string,
  pointEnd?: number | string,
): boolean {
  if (typeof intervalStart !== "number" && typeof intervalStart !== "string") {
    return false;
  }

  if (typeof intervalEnd !== "number" && typeof intervalEnd !== "string") {
    return false;
  }

  if (typeof pointOrStart !== "number" && typeof pointOrStart !== "string") {
    return false;
  }

  if (
    pointEnd !== undefined &&
    typeof pointEnd !== "number" &&
    typeof pointEnd !== "string"
  ) {
    return false;
  }

  const n1 =
    typeof intervalStart === "number" ? intervalStart : Number(intervalStart);
  const n2 =
    typeof intervalEnd === "number" ? intervalEnd : Number(intervalEnd);
  const n3 =
    typeof pointOrStart === "number" ? pointOrStart : Number(pointOrStart);

  if (!Number.isFinite(n1) || !Number.isFinite(n2) || !Number.isFinite(n3)) {
    return false;
  }

  if (n1 > n2) {
    return false;
  }

  if (pointEnd === undefined) {
    return n1 <= n3 && n3 <= n2;
  }

  const n4 = typeof pointEnd === "number" ? pointEnd : Number(pointEnd);

  if (!Number.isFinite(n4)) {
    return false;
  }

  if (n3 > n4) {
    return false;
  }

  return n1 <= n3 && n4 <= n2;
}
