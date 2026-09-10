import {
  FILE_TIME_EPOCH_OFFSET_TICKS,
  MAX_FILE_TIME,
  MIN_FILE_TIME,
  NANOSECONDS_PER_TICK,
} from "../../internal";
import { fromNanoseconds } from "./fromNanoseconds";

/**
 * Convert a Windows `FILETIME` back to an ISO 8601 instant string.
 *
 * - `value` counts 100-nanosecond intervals since 1601-01-01T00:00:00Z.
 * - `FILETIME` is a pair of `DWORD`s, so the value is unsigned: `0n` to `2^64 − 1`,
 *   1601-01-01 to `+060056-05-28T05:36:10.9551615Z`. Anything outside that is not a
 *   `FILETIME`, and a negative value in particular is rejected rather than read as a
 *   pre-1601 instant.
 * - Exact in this direction — 100 ns is coarser than the nanoseconds an ISO string carries,
 *   so nothing is rounded. The loss, if any, happened in `toFileTime`.
 * - Returns "" on invalid input.
 *
 * @param value 100-nanosecond intervals since 1601-01-01 (bigint, 0n to 2^64 − 1)
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromFileTime(0n) // "1601-01-01T00:00:00Z" — the FILETIME epoch
 * @example fromFileTime(116444736000000000n) // "1970-01-01T00:00:00Z"
 * @example fromFileTime(133545476967890000n) // "2024-03-10T12:34:56.789Z"
 * @example fromFileTime(2650467743999999999n) // "9999-12-31T23:59:59.9999999Z" — .NET's DateTime maximum
 * @example fromFileTime(18446744073709551615n) // "+060056-05-28T05:36:10.9551615Z"
 * @example fromFileTime(-1n) // "" — FILETIME is unsigned
 * @example fromFileTime(116444736000000000) // "" — number, not bigint
 */
export function fromFileTime(value: bigint): string {
  if (
    typeof value !== "bigint" ||
    value < MIN_FILE_TIME ||
    value > MAX_FILE_TIME
  ) {
    return "";
  }

  return fromNanoseconds(
    (value - FILE_TIME_EPOCH_OFFSET_TICKS) * NANOSECONDS_PER_TICK,
  );
}
