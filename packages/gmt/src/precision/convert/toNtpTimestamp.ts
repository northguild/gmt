import {
  floorDivide,
  NANOSECONDS_PER_SECOND,
  NTP_EPOCH_OFFSET_NANOSECONDS,
  NTP_ERA_UNITS,
  NTP_UNITS_PER_SECOND,
  parseInstantNanoseconds,
} from "../../internal";

/**
 * Convert an ISO 8601 instant string to a 64-bit NTP timestamp (RFC 5905).
 *
 * - The result packs an unsigned 32-bit count of seconds since 1900-01-01 in the high bits
 *   and a 32-bit fraction in the low bits, where one fractional unit is 2^-32 s (~233 ps).
 * - **The seconds field wraps.** It is unsigned 32-bit, so the timestamp rolls into a new
 *   era every 2^32 seconds (~136.19 years). Era 0 runs from 1900-01-01 to
 *   2036-02-07T06:28:15Z; the next second is `0n` again. The era is not part of the value
 *   and is not recoverable from it — `fromNtpTimestamp` takes it as an explicit argument.
 *   This is the wire format's own ambiguity, not a GMT limitation, so instants outside era 0
 *   wrap here rather than being rejected.
 * - Sub-nanosecond precision is not invented: nanoseconds floor onto the 2^-32 s grid, so a
 *   round trip through `fromNtpTimestamp` is exact for any nanosecond-precision instant.
 * - Returns `0n` on invalid input. `0n` is also the NTP epoch itself (1900-01-01, era 0) and
 *   every era boundary after it — validate the string first with `isValidInstant` when the two
 *   must be told apart.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00Z")
 * @returns 64-bit NTP timestamp as a bigint, or 0n on invalid input
 *
 * @example toNtpTimestamp("1900-01-01T00:00:00Z") // 0n — the NTP epoch
 * @example toNtpTimestamp("1970-01-01T00:00:00Z") // 9487534653230284800n
 * @example toNtpTimestamp("2024-03-10T12:00:00Z") // 16832237967035596800n
 * @example toNtpTimestamp("2036-02-07T06:28:15Z") // 18446744069414584320n — the last second of era 0
 * @example toNtpTimestamp("2036-02-07T06:28:16Z") // 0n — era 1 begins, and the seconds field wraps
 * @example toNtpTimestamp("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toNtpTimestamp("invalid") // 0n
 */
export function toNtpTimestamp(isoString: string): bigint {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return 0n;
  }

  const units = floorDivide(
    (nanoseconds + NTP_EPOCH_OFFSET_NANOSECONDS) * NTP_UNITS_PER_SECOND,
    NANOSECONDS_PER_SECOND,
  );

  return ((units % NTP_ERA_UNITS) + NTP_ERA_UNITS) % NTP_ERA_UNITS;
}
