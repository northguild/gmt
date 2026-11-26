import {
  isPtpUtcOffset,
  NANOSECONDS_PER_SECOND,
  parseInstantNanoseconds,
  readPtpTimestamp,
} from "../../internal";
import type { PtpTimestamp } from "../../types/ptp";

/**
 * Converts a UTC instant to the PTP (IEEE 1588) timestamp a grandmaster announcing
 * `currentUtcOffset` would send.
 *
 * - The result is the instant's seconds since 1970-01-01T00:00:00Z plus the offset, counted as TAI
 *   from 1970-01-01T00:00:00 TAI. It is the inverse of `ptpToUtc` for the same offset.
 * - `currentUtcOffset` is TAI − UTC as announced. It is required, has no default, and must be an
 *   integer from −32 768 to 32 767. The same `ptpTimescale` and `currentUtcOffsetValid`
 *   preconditions as `ptpToUtc` apply: call it only when the grandmaster announces both as true.
 * - Accepts `Z` or a numeric offset (`2024-01-01T02:00:00+02:00`). An offset-less string, a zone or
 *   calendar annotation, and a second of `60` return `null`. With one offset for the whole call, an
 *   inserted second has no reading of its own.
 * - `seconds` comes back as a `bigint`, and every nanosecond written in the input is kept.
 * - Returns `null` for an instant before 1970-01-01T00:00:00Z, which `ptpToUtc` would refuse, and
 *   for a result below 0 seconds. It never throws.
 *
 * @param value ISO 8601 instant string with `Z` or a numeric offset
 * @param currentUtcOffset TAI − UTC in seconds, as announced: an integer from -32768 to 32767
 * @returns the `{ seconds, nanoseconds }` record, or null on invalid input
 *
 * @example utcToPtp("2024-01-01T00:00:00Z", 37) // { seconds: 1704067237n, nanoseconds: 0 }
 * @example utcToPtp("2024-01-01T02:00:00+02:00", 37) // { seconds: 1704067237n, nanoseconds: 0 } — offset input
 * @example utcToPtp("2024-01-01T00:00:00.5Z", 37) // { seconds: 1704067237n, nanoseconds: 500000000 }
 * @example utcToPtp("1970-01-01T00:00:00Z", 37) // { seconds: 37n, nanoseconds: 0 }
 * @example utcToPtp("2016-12-31T23:59:60Z", 37) // null — a leap second has no reading with one offset
 * @example utcToPtp("2024-01-01T00:00:00", 37) // null — no designator
 * @example utcToPtp("1969-12-31T23:59:59Z", 37) // null — before 1970
 * @example utcToPtp("2024-01-01T00:00:00Z", 37.5) // null
 */
export function utcToPtp(
  value: string,
  currentUtcOffset: number,
): PtpTimestamp | null {
  const utc = parseInstantNanoseconds(value);

  if (utc === null || !isPtpUtcOffset(currentUtcOffset)) {
    return null;
  }

  // GMT rule: an instant before 1970-01-01T00:00:00Z is refused, as ptpToUtc refuses its result.
  if (utc < 0n) {
    return null;
  }

  const ptp = utc + BigInt(currentUtcOffset) * NANOSECONDS_PER_SECOND;

  if (ptp < 0n) {
    return null;
  }

  // ptp is not negative, so bigint division truncates the same way floor division does.
  return readPtpTimestamp({
    seconds: ptp / NANOSECONDS_PER_SECOND,
    nanoseconds: Number(ptp % NANOSECONDS_PER_SECOND),
  });
}
