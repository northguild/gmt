import type { PtpTimestamp } from "../types/ptp";
import { readSecondsRecord } from "./protoRecord";

/** One past the largest PTP seconds value: 2^48 (RFC 8877 section 4.3, 80 - 32 bits). */
export const PTP_SECONDS_LIMIT = 281_474_976_710_656n;

/** The `int16` minimum of `currentUtcOffset` (RFC 8575 section 3, `time-properties-ds`). */
export const PTP_UTC_OFFSET_MIN = -32_768;
/** The `int16` maximum of `currentUtcOffset` (RFC 8575 section 3, `time-properties-ds`). */
export const PTP_UTC_OFFSET_MAX = 32_767;

/** The most nanoseconds a PTP timestamp holds: 10^9 - 1 (RFC 8877 section 4.3, Nanoseconds field). */
const PTP_NANOSECONDS_MAX = 999_999_999;

/**
 * Read a caller's value as a PTP timestamp with `bigint` seconds.
 *
 * `seconds` is a `bigint` or a safe-integer `number` from 0 to 2^48 - 1, and `nanoseconds` an
 * integer from 0 to 999 999 999. Both are required. The result is a new object, never the caller's.
 * Never throws: a throwing getter or a revoked Proxy returns `null`.
 *
 * @param value candidate record
 * @returns the timestamp, or `null` when `value` is not a valid PTP timestamp
 *
 * @example readPtpTimestamp({ seconds: 5, nanoseconds: 1 }) // { seconds: 5n, nanoseconds: 1 }
 * @example readPtpTimestamp({ seconds: 281474976710656n, nanoseconds: 0 }) // null
 * @example readPtpTimestamp({ seconds: 0n, nanos: 0 }) // null
 */
export function readPtpTimestamp(value: unknown): PtpTimestamp | null {
  const record = readSecondsRecord(value, "nanoseconds");

  if (
    record === null ||
    record.seconds < 0n ||
    record.seconds >= PTP_SECONDS_LIMIT ||
    record.fraction < 0 ||
    record.fraction > PTP_NANOSECONDS_MAX
  ) {
    return null;
  }

  // `+ 0` turns an integer -0 into 0
  return { seconds: record.seconds, nanoseconds: record.fraction + 0 };
}

/**
 * Whether a value is a PTP `currentUtcOffset`: an integer `number` in the `int16` range.
 *
 * @param value candidate offset
 * @returns `true` for an integer from -32768 to 32767
 *
 * @example isPtpUtcOffset(37) // true
 * @example isPtpUtcOffset(40000) // false
 * @example isPtpUtcOffset("37") // false
 */
export function isPtpUtcOffset(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= PTP_UTC_OFFSET_MIN &&
    (value as number) <= PTP_UTC_OFFSET_MAX
  );
}
