import {
  floorDivide,
  NANOSECONDS_PER_SECOND,
  NTP_EPOCH_OFFSET_NANOSECONDS,
  NTP_ERA_UNITS,
  NTP_UNITS_PER_SECOND,
} from "../../internal";
import { fromNanoseconds } from "./fromNanoseconds";

/**
 * Convert a 64-bit NTP timestamp (RFC 5905) back to an ISO 8601 instant string.
 *
 * - `value` is unsigned: the whole 64-bit timestamp, seconds since 1900-01-01 in the high
 *   32 bits and 2^-32 s units in the low 32. Values outside `0n`–`2^64 − 1` are rejected.
 * - **`era` is required information the value does not carry.** The seconds field wraps
 *   every 2^32 seconds (~136.19 years), so one timestamp names one instant per era: era 0
 *   is 1900-01-01 to 2036-02-07T06:28:15Z, era 1 starts at 2036-02-07T06:28:16Z, era -1
 *   starts at 1763-11-24T17:31:44Z. It defaults to 0; passing `undefined` explicitly is
 *   invalid input, not a request for era 0.
 * - Rounds to the nearest nanosecond. One NTP unit is ~233 ps, finer than an ISO string can
 *   express, so rounding — not truncation — is what makes `fromNtpTimestamp(toNtpTimestamp(iso))`
 *   return `iso` exactly rather than one nanosecond early.
 * - **The top two values of an era round onto the next era's first instant.** `2^64 − 1` and
 *   `2^64 − 2` in era 0 both render as `"2036-02-07T06:28:16Z"`, which is where era 1 starts:
 *   the last 0.47 ns of an era has no nanosecond of its own, and the nearest one is the era
 *   boundary. `toNtpTimestamp` cannot produce either value from a nanosecond-precision
 *   instant — its largest era-0 output is `18446744073709551611n` — so this does not affect
 *   the round trip.
 * - Returns "" when the resulting instant is outside the range `Temporal.Instant` can
 *   represent, which a large `era` will reach.
 * - Returns "" on invalid input.
 *
 * @param value 64-bit NTP timestamp (bigint, 0n to 2^64 − 1)
 * @param era optional 136-year era selector (default 0) — omit the argument entirely for
 *   era 0; passing `undefined` explicitly is invalid input and returns ""
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromNtpTimestamp(0n) // "1900-01-01T00:00:00Z" — the NTP epoch
 * @example fromNtpTimestamp(9487534653230284800n) // "1970-01-01T00:00:00Z"
 * @example fromNtpTimestamp(16832246972675778412n) // "2024-03-10T12:34:56.789Z"
 * @example fromNtpTimestamp(18446744069414584320n) // "2036-02-07T06:28:15Z" — the last second of era 0
 * @example fromNtpTimestamp(0n, 1) // "2036-02-07T06:28:16Z" — the same value, one era on
 * @example fromNtpTimestamp(0n, -1) // "1763-11-24T17:31:44Z"
 * @example fromNtpTimestamp(-1n) // "" — the timestamp is unsigned
 * @example fromNtpTimestamp(0n, undefined) // "" — an explicit era must be a safe integer
 */
export function fromNtpTimestamp(
  value: bigint,
  ...eraInput: [era?: number]
): string {
  if (typeof value !== "bigint" || value < 0n || value >= NTP_ERA_UNITS) {
    return "";
  }

  const era = eraInput.length === 0 ? 0 : eraInput[0];

  if (typeof era !== "number" || !Number.isSafeInteger(era)) {
    return "";
  }

  const units = value + BigInt(era) * NTP_ERA_UNITS;
  const nanoseconds =
    floorDivide(
      units * NANOSECONDS_PER_SECOND + NTP_UNITS_PER_SECOND / 2n,
      NTP_UNITS_PER_SECOND,
    ) - NTP_EPOCH_OFFSET_NANOSECONDS;

  return fromNanoseconds(nanoseconds);
}
