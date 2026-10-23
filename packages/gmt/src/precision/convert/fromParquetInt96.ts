import {
  JULIAN_DAY_OF_UNIX_EPOCH,
  NANOSECONDS_PER_DAY,
  instantStringFromEpochNanoseconds,
} from "../../internal";
import type { ParquetInt96 } from "./toParquetInt96";

const BYTE_LENGTH = 12;

/**
 * Convert a Parquet `INT96` timestamp back to an ISO 8601 instant string.
 *
 * - **Deprecated format.** Read old files with this; write new ones with the `TIMESTAMP`
 *   logical type on `INT64` (`fromNanoseconds` and `toNanoseconds` cover that).
 * - Accepts the 12 stored bytes (a `Uint8Array` or Node `Buffer`: `nanosOfDay` as a
 *   little-endian `int64`, then `julianDay` as a little-endian `int32`) or the
 *   `{ julianDay, nanosOfDay }` record most readers expose. Any other length of bytes is invalid.
 * - `julianDay` is the Julian Day Number of the UTC date (2440588 is 1970-01-01) and must be an
 *   integer inside the instant range (far inside a signed 32-bit integer). `nanosOfDay` counts from that date's midnight, not noon, and must be
 *   a `bigint` in `[0n, 86_400_000_000_000n)`. parquet-format states no range; GMT rejects
 *   a full day or more so one instant has one spelling.
 * - **No zone is recorded.** The value is always read as a UTC instant, as the Arrow and Spark
 *   readers do. Impala, the legacy writer, stored local wall-clock time instead, and nothing
 *   in the file says which writer made it: a value Impala wrote comes back as that wall time
 *   wrongly marked `Z`.
 * - Returns "" on invalid input, including a result outside the instant range.
 *
 * @param value The 12 stored bytes, or a `{ julianDay, nanosOfDay }` record
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromParquetInt96({ julianDay: 2440588, nanosOfDay: 0n }) // "1970-01-01T00:00:00Z"
 * @example fromParquetInt96({ julianDay: 2440588, nanosOfDay: 1n }) // "1970-01-01T00:00:00.000000001Z"
 * @example fromParquetInt96({ julianDay: 2440587, nanosOfDay: 86399999999999n }) // "1969-12-31T23:59:59.999999999Z"
 * @example fromParquetInt96({ julianDay: 2460380, nanosOfDay: 45296789000000n }) // "2024-03-10T12:34:56.789Z"
 * @example fromParquetInt96({ julianDay: 0, nanosOfDay: 0n }) // "-004713-11-24T00:00:00Z" — Julian Day 0
 * @example fromParquetInt96(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0x8c, 0x3d, 0x25, 0x00])) // "1970-01-01T00:00:00Z"
 * @example fromParquetInt96({ julianDay: 102440588, nanosOfDay: 1n }) // "" — past the instant range
 * @example fromParquetInt96({ julianDay: 2440588, nanosOfDay: 86400000000000n }) // "" — a full day of nanoseconds
 * @example fromParquetInt96({ julianDay: 2440588, nanosOfDay: 0 }) // "" — number, not bigint
 * @example fromParquetInt96(new Uint8Array(11)) // "" — not 12 bytes
 */
export function fromParquetInt96(value: ParquetInt96 | Uint8Array): string {
  let nanosOfDay: unknown;
  let julianDay: unknown;

  // Reading a hostile value (a throwing getter, a Proxy trap, a revoked Proxy) can throw.
  try {
    if (value instanceof Uint8Array) {
      if (value.length !== BYTE_LENGTH) {
        return "";
      }

      const view = new DataView(value.buffer, value.byteOffset, BYTE_LENGTH);

      nanosOfDay = view.getBigInt64(0, true);
      julianDay = view.getInt32(8, true);
    } else {
      ({ nanosOfDay, julianDay } = value);
    }
  } catch {
    return "";
  }

  if (
    !Number.isInteger(julianDay) ||
    typeof nanosOfDay !== "bigint" ||
    nanosOfDay < 0n ||
    nanosOfDay >= NANOSECONDS_PER_DAY
  ) {
    return "";
  }

  return instantStringFromEpochNanoseconds(
    BigInt((julianDay as number) - JULIAN_DAY_OF_UNIX_EPOCH) *
      NANOSECONDS_PER_DAY +
      nanosOfDay,
  );
}
