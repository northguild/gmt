/**
 * Return the offset of boundary `index` when a span of `total` integer units is cut into `count`
 * equal pieces: `(total · index) / count` rounded to the nearest unit, an exact half rounding up
 * (as `Math.round` does for the non-negative quotient).
 *
 * - Exact at any magnitude: the product is taken in `bigint`, never in a double, so spans past
 *   2^53 units (about 104 days of nanoseconds) keep every unit.
 * - `total` must be non-negative and `count` a positive integer; `index` runs from 0 to `count`.
 *
 * @param total span length in integer units (nanoseconds or milliseconds)
 * @param index boundary number, 0 (the start) to `count` (the end)
 * @param count number of pieces
 * @returns the boundary's offset from the start, in the same units
 *
 * @example divisionBoundary(1_000_000_000n, 1, 3) // 333_333_333n
 * @example divisionBoundary(1_000_000_000n, 2, 3) // 666_666_667n
 * @example divisionBoundary(31_536_000_000_000_000_003n, 1, 3) // 10_512_000_000_000_000_001n
 */
export function divisionBoundary(
  total: bigint,
  index: number,
  count: number,
): bigint {
  const pieces = BigInt(count);
  // floor(total · index / count + 1/2); bigint division truncates, which is floor for these signs.
  return (2n * total * BigInt(index) + pieces) / (2n * pieces);
}
