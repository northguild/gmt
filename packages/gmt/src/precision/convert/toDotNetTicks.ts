import {
  DOT_NET_TICKS_EPOCH_OFFSET,
  floorDivide,
  MAX_DOT_NET_TICKS,
  MIN_DOT_NET_TICKS,
  NANOSECONDS_PER_TICK,
  parseInstantNanoseconds,
} from "../../internal";

/**
 * Convert an ISO 8601 instant string to .NET `DateTime.Ticks`.
 *
 * - Ticks count 100-nanosecond intervals since 0001-01-01T00:00:00 in the proleptic
 *   Gregorian calendar — the same unit as `FILETIME`, a different origin. The two differ by
 *   `504911232000000000n`, the tick count at 1601-01-01.
 * - Sub-100 ns digits floor away, toward negative infinity, so the tick grid stays uniform
 *   either side of the epoch. Reach for `truncateNanoseconds` first if the caller needs to
 *   see the loss.
 * - **The range is `DateTime`'s own, and instants outside it are invalid input, not a
 *   negative tick count:** `DateTime.MinValue` (`0n`, 0001-01-01) to `DateTime.MaxValue`
 *   (`3155378975999999999n`, 9999-12-31T23:59:59.9999999).
 * - The result is a bare tick count, with no `DateTimeKind`. .NET stores the kind in the top
 *   two bits of `DateTime`'s backing field, not in `Ticks`; treat the value as UTC.
 * - Returns `0n` on invalid input. `0n` is also `DateTime.MinValue` itself (0001-01-01) —
 *   validate the string first with `isValidInstant` when the two must be told apart.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00Z")
 * @returns 100-nanosecond intervals since 0001-01-01 as a bigint, or 0n on invalid input
 *
 * @example toDotNetTicks("0001-01-01T00:00:00Z") // 0n — DateTime.MinValue
 * @example toDotNetTicks("1970-01-01T00:00:00Z") // 621355968000000000n
 * @example toDotNetTicks("2024-03-10T12:34:56.789Z") // 638456708967890000n
 * @example toDotNetTicks("2024-03-10T12:00:00.123456789Z") // 638456688001234567n — floors to 100 ns
 * @example toDotNetTicks("9999-12-31T23:59:59.9999999Z") // 3155378975999999999n — DateTime.MaxValue
 * @example toDotNetTicks("+010000-01-01T00:00:00Z") // 0n — past DateTime.MaxValue
 * @example toDotNetTicks("invalid") // 0n
 */
export function toDotNetTicks(isoString: string): bigint {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return 0n;
  }

  const ticks =
    floorDivide(nanoseconds, NANOSECONDS_PER_TICK) + DOT_NET_TICKS_EPOCH_OFFSET;

  if (ticks < MIN_DOT_NET_TICKS || ticks > MAX_DOT_NET_TICKS) {
    return 0n;
  }

  return ticks;
}
