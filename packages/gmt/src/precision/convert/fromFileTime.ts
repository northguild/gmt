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
 * - The accepted range is `0n` to `2^63 − 1`, 1601-01-01 to
 *   `+030828-09-14T02:48:05.4775807Z`. `FILETIME` is a pair of `DWORD`s, so a negative value is
 *   rejected rather than read as a pre-1601 instant. Values from `2^63` up are rejected too:
 *   Microsoft's `FileTimeToSystemTime` requires a value "less than 0x8000000000000000", and
 *   `SetFileTime` uses `0xFFFFFFFFFFFFFFFF` (`2^64 − 1`) as its "do not modify" marker.
 * - To decode the raw unsigned count anyway, for example to inspect a marker, compute
 *   `fromNanoseconds((value - 116444736000000000n) * 100n)`.
 * - Exact in this direction — 100 ns is coarser than the nanoseconds an ISO string carries,
 *   so nothing is rounded. The loss, if any, happened in `toFileTime`.
 * - Returns "" on invalid input.
 *
 * @param value 100-nanosecond intervals since 1601-01-01 (bigint, 0n to 2^63 − 1)
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromFileTime(0n) // "1601-01-01T00:00:00Z" — the FILETIME epoch
 * @example fromFileTime(116444736000000000n) // "1970-01-01T00:00:00Z"
 * @example fromFileTime(133545476967890000n) // "2024-03-10T12:34:56.789Z"
 * @example fromFileTime(2650467743999999999n) // "9999-12-31T23:59:59.9999999Z" — .NET's DateTime maximum
 * @example fromFileTime(9223372036854775807n) // "+030828-09-14T02:48:05.4775807Z" — 2^63 − 1, the largest accepted
 * @example fromFileTime(9223372036854775808n) // "" — 2^63, which FileTimeToSystemTime rejects
 * @example fromFileTime(18446744073709551615n) // "" — SetFileTime's do-not-modify marker
 * @example fromNanoseconds((18446744073709551615n - 116444736000000000n) * 100n) // "+060056-05-28T05:36:10.9551615Z" — raw unsigned decode
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
