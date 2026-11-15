/**
 * A PTP (IEEE 1588) timestamp: 32 bits of nanoseconds and 48 bits (80 - 32) of whole
 * seconds, 80 bits in all (RFC 8877 section 4.3).
 *
 * - The count is TAI from 1970-01-01T00:00:00 TAI and does not step at a leap second. It is not a
 *   Unix time, even though the epoch value is the same: convert it with the `currentUtcOffset` the
 *   grandmaster announces.
 * - GMT returns `seconds` as a `bigint`. It also reads a safe-integer `number`, because a 48-bit
 *   count fits in one.
 */
export interface PtpTimestamp {
  /** Whole TAI seconds since 1970-01-01T00:00:00 TAI: an integer from 0 to 2^48 - 1. */
  seconds: bigint;
  /** Nanoseconds past `seconds`: an integer from 0 to 999 999 999. */
  nanoseconds: number;
}
