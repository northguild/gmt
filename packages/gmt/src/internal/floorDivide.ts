/**
 * Divide two bigints, flooring toward negative infinity.
 *
 * BigInt `/` truncates toward zero, so `-1n / 100n` is `0n` — the same slot as `0n / 100n`.
 * Every foreign-epoch bridge in `precision/convert/` scales nanoseconds down to a coarser
 * unit (100 ns for FILETIME and .NET ticks, 2^-32 s for NTP), and a truncating divide would
 * make the last tick before an epoch collide with the first tick after it. Flooring keeps
 * the unit grid uniform across zero, which is also what `truncateNanoseconds` does.
 *
 * @example floorDivide(150n, 100n) // 1n
 * @example floorDivide(-150n, 100n) // -2n
 * @example floorDivide(-100n, 100n) // -1n
 * @example floorDivide(0n, 100n) // 0n
 */
export function floorDivide(value: bigint, divisor: bigint): bigint {
  const remainder = ((value % divisor) + divisor) % divisor;

  return (value - remainder) / divisor;
}
