import {
  instantStringFromEpochNanoseconds,
  isPtpUtcOffset,
  NANOSECONDS_PER_SECOND,
  readPtpTimestamp,
} from "../../internal";
import type { PtpTimestamp } from "../../types/ptp";

/**
 * Converts a PTP (IEEE 1588) timestamp to a UTC instant string ending in `Z`.
 *
 * - A PTP timestamp counts TAI seconds since 1970-01-01T00:00:00 TAI. The result is
 *   `seconds + nanoseconds × 10⁻⁹ − currentUtcOffset` seconds after 1970-01-01T00:00:00Z.
 * - `currentUtcOffset` is TAI − UTC, as the grandmaster announces it in its time properties
 *   (RFC 8575 section 3 defines the `current-utc-offset` leaf and its `int16` type only; that the
 *   Announce message carries it is IEEE 1588, not reached). It is required and has no default.
 *   Passing `0` gives the reading of a receiver that ignores the offset: 37 s ahead from 2017 on.
 * - **Two preconditions.** Call this function only when the grandmaster announces `ptpTimescale`
 *   true and `currentUtcOffsetValid` true. On the arbitrary time scale (ARB) the offset "has no
 *   meaning", and when the offset is not marked valid the number is not valid. The function cannot
 *   see either flag, so it cannot check them. When `timeTraceable` is false, the offset is not
 *   traceable to a primary reference.
 * - It applies the announced offset and does not look up the leap-second table. To check the
 *   grandmaster's offset, compare `currentUtcOffset` with `taiMinusUtc(result)`.
 * - It never writes a second of `60`. During an inserted second, the reading follows whichever
 *   offset the caller passes. Pass the new offset once the grandmaster announces it.
 * - `seconds` can be a `bigint` or a safe-integer `number`, from 0 to 2^48 − 1. `nanoseconds` must
 *   be an integer `number` from 0 to 999 999 999. Both members are required.
 * - Returns `""` for an invalid record or offset, for a result before 1970-01-01T00:00:00Z (in
 *   practice a clock that has not been set), and for a result past `+275760-09-13T00:00:00Z`.
 *   A year past 9999 is written in Temporal's expanded form (`+010000-…`). It never throws.
 *
 * @param timestamp PTP timestamp, with `bigint` or safe-integer `number` seconds
 * @param currentUtcOffset TAI − UTC in seconds, as announced: an integer from -32768 to 32767
 * @returns the UTC instant string, or "" on invalid input
 *
 * @example ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37) // "2024-01-01T00:00:00Z"
 * @example ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 0) // "2024-01-01T00:00:37Z" — the offset ignored
 * @example ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 36) // "2024-01-01T00:00:01Z" — a grandmaster still on the 2016 offset
 * @example ptpToUtc({ seconds: 1704067237, nanoseconds: 500000000 }, 37) // "2024-01-01T00:00:00.5Z" — number seconds
 * @example ptpToUtc({ seconds: 37n, nanoseconds: 0 }, 37) // "1970-01-01T00:00:00Z"
 * @example ptpToUtc({ seconds: 0n, nanoseconds: 0 }, 37) // "" — before 1970: an unset clock
 * @example ptpToUtc({ seconds: 0n, nanoseconds: 1000000000 }, 37) // ""
 * @example ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37.5) // ""
 */
export function ptpToUtc(
  timestamp: PtpTimestamp | { seconds: number; nanoseconds: number },
  currentUtcOffset: number,
): string {
  const record = readPtpTimestamp(timestamp);

  if (record === null || !isPtpUtcOffset(currentUtcOffset)) {
    return "";
  }

  const nanoseconds =
    (record.seconds - BigInt(currentUtcOffset)) * NANOSECONDS_PER_SECOND +
    BigInt(record.nanoseconds);

  // GMT rule: a result before 1970-01-01T00:00:00Z is an unset clock.
  if (nanoseconds < 0n) {
    return "";
  }

  return instantStringFromEpochNanoseconds(nanoseconds);
}
