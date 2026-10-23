import {
  floorDivide,
  JULIAN_DAY_OF_UNIX_EPOCH,
  NANOSECONDS_PER_DAY,
  parseInstantNanoseconds,
} from "../../internal";

/**
 * A Parquet `INT96` timestamp as most readers expose it: a Julian Day Number and the
 * nanoseconds into that day.
 *
 * On disk it is 12 bytes: `nanosOfDay` as a little-endian `int64`, then `julianDay` as a
 * little-endian `int32` (apache/parquet-format `INT96_TIMESTAMP_ORDER`).
 */
export interface ParquetInt96 {
  /** Julian Day Number of the UTC date, a signed 32-bit integer (2440588 is 1970-01-01). */
  julianDay: number;
  /** Nanoseconds since that date's midnight UTC, in `[0n, 86_400_000_000_000n)`. */
  nanosOfDay: bigint;
}

/**
 * Convert an ISO 8601 instant string to a Parquet `INT96` timestamp record.
 *
 * - `INT96` is deprecated in Parquet; write new files with the `TIMESTAMP` logical type on
 *   `INT64` (`toNanoseconds` and friends). This function is for writing files an old reader
 *   still expects.
 * - The day is the Julian Day Number of the **UTC date** (2440588 is 1970-01-01) and the
 *   nanoseconds count from that date's midnight, not from noon as an astronomical Julian Date
 *   does. An offset or zone in the input is applied first.
 * - Exact: `INT96` holds nanoseconds, so nothing is rounded. Instants before the epoch floor
 *   toward negative infinity, so `nanosOfDay` is never negative.
 * - Every valid instant fits the signed 32-bit day.
 * - Returns a record only. To get the 12 stored bytes, write `nanosOfDay` with
 *   `DataView.setBigInt64(0, nanosOfDay, true)` and `julianDay` with
 *   `DataView.setInt32(8, julianDay, true)`.
 * - Returns `null` on invalid input.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:34:56.789Z")
 * @returns `{ julianDay, nanosOfDay }`, or `null` on invalid input
 *
 * @example toParquetInt96("1970-01-01T00:00:00Z") // { julianDay: 2440588, nanosOfDay: 0n }
 * @example toParquetInt96("1969-12-31T23:59:59.999999999Z") // { julianDay: 2440587, nanosOfDay: 86399999999999n }
 * @example toParquetInt96("2024-03-10T12:34:56.789Z") // { julianDay: 2460380, nanosOfDay: 45296789000000n }
 * @example toParquetInt96("2024-03-10T13:34:56.789+01:00[Europe/Paris]") // { julianDay: 2460380, nanosOfDay: 45296789000000n }
 * @example toParquetInt96("-004713-11-24T00:00:00Z") // { julianDay: 0, nanosOfDay: 0n } — Julian Day 0
 * @example toParquetInt96("2024-03-10T12:34:56") // null — no offset designator
 * @example toParquetInt96("invalid") // null
 */
export function toParquetInt96(isoString: string): ParquetInt96 | null {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return null;
  }

  // Parquet INT96: day is the JDN of the UTC date; 2440588 is 1970-01-01 (Arrow
  // kJulianToUnixEpochDays, Spark JULIAN_DAY_OF_EPOCH; JDN per IAU 1997 Resolution B1).
  const day = floorDivide(nanoseconds, NANOSECONDS_PER_DAY);

  return {
    julianDay: Number(day) + JULIAN_DAY_OF_UNIX_EPOCH,
    nanosOfDay: nanoseconds - day * NANOSECONDS_PER_DAY,
  };
}
