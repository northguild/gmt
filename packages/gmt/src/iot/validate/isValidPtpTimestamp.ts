import { readPtpTimestamp } from "../../internal/ptpTimestamp";
import type { PtpTimestamp } from "../../types/ptp";

/**
 * Return true when `value` is a PTP timestamp record that `ptpToUtc` reads. It checks the ranges
 * of the 80-bit PTP (IEEE 1588) timestamp: 32 bits of nanoseconds (RFC 8877 section 4.3) and the
 * other 48 bits (80 - 32) of seconds, the nanoseconds in 0 to 10^9 - 1.
 *
 * - `seconds` is a `bigint`, or a safe-integer `number`, from 0 to 2^48 - 1.
 * - `nanoseconds` is an integer `number` from 0 to 999 999 999.
 * - Both members are required. Extra members are ignored.
 * - It checks the record, not a conversion. A record that passes can still make `ptpToUtc` return
 *   `""`: when the result would fall before 1970 (`{ seconds: 0n, nanoseconds: 0 }` with an
 *   offset of 37), or past Temporal's last instant, `+275760-09-13T00:00:00Z`.
 * - It narrows `value` to a PTP timestamp record. Never throws: a Proxy or a throwing getter is
 *   not a valid record.
 *
 * @param value candidate value of any type
 * @returns true for a PTP timestamp record, or false on invalid input
 *
 * @example isValidPtpTimestamp({ seconds: 1704067237n, nanoseconds: 0 }) // true
 * @example isValidPtpTimestamp({ seconds: 1704067237, nanoseconds: 999999999 }) // true — number seconds
 * @example isValidPtpTimestamp({ seconds: 0n, nanoseconds: 0 }) // true — although ptpToUtc(…, 37) is ""
 * @example isValidPtpTimestamp({ seconds: 281474976710656n, nanoseconds: 0 }) // false — 2⁴⁸
 * @example isValidPtpTimestamp({ seconds: -1n, nanoseconds: 0 }) // false
 * @example isValidPtpTimestamp({ seconds: 0n, nanoseconds: 1000000000 }) // false
 * @example isValidPtpTimestamp({ seconds: 1.5, nanoseconds: 0 }) // false
 * @example isValidPtpTimestamp({ seconds: 0n }) // false — missing nanoseconds
 * @example isValidPtpTimestamp(null) // false
 * @example isValidPtpTimestamp("2024-01-01T00:00:00Z") // false
 */
export function isValidPtpTimestamp(
  value: unknown,
): value is PtpTimestamp | { seconds: number; nanoseconds: number } {
  // readPtpTimestamp never throws (it is the same check ptpToUtc runs)
  return readPtpTimestamp(value) !== null;
}
