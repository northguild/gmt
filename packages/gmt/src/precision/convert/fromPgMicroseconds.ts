import {
  MIN_PG_MICROSECONDS,
  NANOSECONDS_PER_MICROSECOND,
  PG_EPOCH_OFFSET_MICROSECONDS,
} from "../../internal";
import { fromNanoseconds } from "./fromNanoseconds";

/**
 * Convert PostgreSQL's internal `timestamptz` value back to an ISO 8601 instant string.
 *
 * - `value` is a signed count of microseconds since 2000-01-01T00:00:00Z, the number
 *   PostgreSQL stores and the binary wire format carries. It is not a Unix timestamp.
 * - Accepted range is the narrower of PostgreSQL's and `Temporal.Instant`'s, one binding at
 *   each end: `-211813488000000000n` (`MIN_TIMESTAMP`, `-004713-11-24T00:00:00Z` — the
 *   manual's "4713 BC", counted in the Julian calendar) up to `8639053315200000000n`
 *   (`+275760-09-13`, where `Temporal` stops, well before PostgreSQL's 294276 AD).
 *   Anything outside returns "".
 * - Exact in this direction — a microsecond is coarser than the nanoseconds an ISO string
 *   carries, so nothing is rounded. The loss, if any, happened in `toPgMicroseconds`.
 * - Returns "" on invalid input.
 *
 * @param value microseconds since 2000-01-01 (bigint)
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromPgMicroseconds(0n) // "2000-01-01T00:00:00Z" — the PostgreSQL epoch
 * @example fromPgMicroseconds(-946684800000000n) // "1970-01-01T00:00:00Z"
 * @example fromPgMicroseconds(763389296789000n) // "2024-03-10T12:34:56.789Z"
 * @example fromPgMicroseconds(763387200123456n) // "2024-03-10T12:00:00.123456Z"
 * @example fromPgMicroseconds(-211813488000000001n) // "" — one microsecond before PostgreSQL's minimum
 * @example fromPgMicroseconds(9223372036854775807n) // "" — int64 maximum, still past Temporal's range
 * @example fromPgMicroseconds(763387200123456) // "" — number, not bigint
 */
export function fromPgMicroseconds(value: bigint): string {
  if (typeof value !== "bigint" || value < MIN_PG_MICROSECONDS) {
    return "";
  }

  return fromNanoseconds(
    (value + PG_EPOCH_OFFSET_MICROSECONDS) * NANOSECONDS_PER_MICROSECOND,
  );
}
