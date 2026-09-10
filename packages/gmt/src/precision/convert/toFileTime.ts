import {
  FILE_TIME_EPOCH_OFFSET_TICKS,
  floorDivide,
  MAX_FILE_TIME,
  MIN_FILE_TIME,
  NANOSECONDS_PER_TICK,
  parseInstantNanoseconds,
} from "../../internal";

/**
 * Convert an ISO 8601 instant string to a Windows `FILETIME`.
 *
 * - A `FILETIME` counts 100-nanosecond intervals since 1601-01-01T00:00:00Z. The Unix delta
 *   is 11 644 473 600 seconds, i.e. `116444736000000000n` ticks.
 * - Sub-100 ns digits floor away, toward negative infinity, so the tick grid stays uniform
 *   either side of the epoch. Reach for `truncateNanoseconds` first if the caller needs to
 *   see the loss.
 * - **The range is the format's own, and instants outside it are invalid input, not a
 *   negative tick count.** `FILETIME` is a pair of `DWORD`s, so it holds `0n` to `2^64 − 1` —
 *   1601-01-01 to `+060056-05-28T05:36:10.9551615Z`. Consumers commonly narrow this further:
 *   .NET's `DateTime.FromFileTimeUtc` stops at 9999-12-31.
 * - Returns `0n` on invalid input. `0n` is also the FILETIME epoch itself (1601-01-01) —
 *   validate the string first with `isValidInstant` when the two must be told apart.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00Z")
 * @returns 100-nanosecond intervals since 1601-01-01 as a bigint, or 0n on invalid input
 *
 * @example toFileTime("1601-01-01T00:00:00Z") // 0n — the FILETIME epoch
 * @example toFileTime("1970-01-01T00:00:00Z") // 116444736000000000n
 * @example toFileTime("2024-03-10T12:34:56.789Z") // 133545476967890000n
 * @example toFileTime("2024-03-10T12:00:00.123456789Z") // 133545456001234567n — floors to 100 ns
 * @example toFileTime("1600-12-31T23:59:59Z") // 0n — before the FILETIME epoch
 * @example toFileTime("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toFileTime("invalid") // 0n
 */
export function toFileTime(isoString: string): bigint {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return 0n;
  }

  const ticks =
    floorDivide(nanoseconds, NANOSECONDS_PER_TICK) +
    FILE_TIME_EPOCH_OFFSET_TICKS;

  if (ticks < MIN_FILE_TIME || ticks > MAX_FILE_TIME) {
    return 0n;
  }

  return ticks;
}
