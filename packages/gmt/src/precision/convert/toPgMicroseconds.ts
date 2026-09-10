import {
  MIN_PG_MICROSECONDS,
  NANOSECONDS_PER_MICROSECOND,
  parseInstantNanoseconds,
  PG_EPOCH_OFFSET_MICROSECONDS,
} from "../../internal";
import { truncateNanoseconds } from "../calculate";

/**
 * Convert an ISO 8601 instant string to PostgreSQL's internal `timestamptz` value.
 *
 * - PostgreSQL stores a `timestamp`/`timestamptz` as a signed 64-bit count of microseconds
 *   since 2000-01-01T00:00:00Z — not since the Unix epoch. The wire protocol's binary format
 *   carries this same value; only the text format and the client libraries convert to 1970.
 * - Sub-microsecond digits floor away, via `truncateNanoseconds(..., "us")`, so the grid stays
 *   uniform either side of the epoch. `timestamptz` has no finer resolution to write them to.
 * - **Instants outside PostgreSQL's own timestamp range are invalid input.** It starts at
 *   `-004713-11-24T00:00:00Z` (Julian Day 0 — the manual's "4713 BC", counted in the Julian
 *   calendar), which is 40× later than the earliest instant `Temporal` can represent, so an
 *   in-range `Temporal` instant is not automatically an in-range PostgreSQL one. The upper
 *   end is the other way round: PostgreSQL stops at 294276 AD, past what `Temporal` holds,
 *   so the instant range binds there first.
 * - Returns `0n` on invalid input. `0n` is also the PostgreSQL epoch itself (2000-01-01) —
 *   validate the string first with `isValidInstant` when the two must be told apart.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00Z")
 * @returns microseconds since 2000-01-01 as a bigint, or 0n on invalid input
 *
 * @example toPgMicroseconds("2000-01-01T00:00:00Z") // 0n — the PostgreSQL epoch
 * @example toPgMicroseconds("1970-01-01T00:00:00Z") // -946684800000000n
 * @example toPgMicroseconds("2024-03-10T12:34:56.789Z") // 763389296789000n
 * @example toPgMicroseconds("2024-03-10T12:00:00.123456789Z") // 763387200123456n — floors to microseconds
 * @example toPgMicroseconds("-005000-01-01T00:00:00Z") // 0n — before PostgreSQL's 4713 BC minimum
 * @example toPgMicroseconds("2024-03-10T12:00:00") // 0n — no offset designator
 * @example toPgMicroseconds("invalid") // 0n
 */
export function toPgMicroseconds(isoString: string): bigint {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return 0n;
  }

  const microseconds =
    truncateNanoseconds(nanoseconds, "us") / NANOSECONDS_PER_MICROSECOND -
    PG_EPOCH_OFFSET_MICROSECONDS;

  if (microseconds < MIN_PG_MICROSECONDS) {
    return 0n;
  }

  return microseconds;
}
