import {
  floorDivide,
  isValidEpochNanoseconds,
  MAX_INT64,
  MIN_INT64,
  NANOSECONDS_PER_DAY,
  parseInstantNanoseconds,
  resolveArrowTimestampOptions,
} from "../../internal";
import { epochDayOf } from "../../internal/epochDay";
import { Temporal } from "../../internal/temporal";
import { isValidDateTime } from "../../plain/validate/isValidDateTime";
import type { ArrowTimestampOptions } from "./fromArrowTimestamp";

/**
 * Convert an ISO 8601 string to an Apache Arrow `Timestamp` `int64`.
 *
 * - The column decides the input. With a `timeZone` the column holds instants, so `isoString`
 *   must be an instant (`Z` or an offset). With none (omitted, `undefined` or `""`) it holds
 *   wall-clock times, so `isoString` must be a plain date-time with no offset or `Z`. The other
 *   kind returns `0n`: a wall time is never silently read as UTC, nor an instant as a wall time.
 * - On a zoneless column a zone annotation (`[Asia/Tokyo]`) is ignored, as `Temporal.PlainDateTime.from`
 *   ignores it; the wall time is read as written.
 * - The `timeZone` is not applied to the value; it only says which kind of column this is.
 * - Digits below the unit floor toward negative infinity, so `1969-12-31T23:59:59.9999999Z` in
 *   microseconds is `-1n`.
 * - A result outside `int64` returns `0n`.
 * - `0n` is also the epoch, so when the two must be told apart validate first
 *   (`isValidInstant` or `isValidDateTime`).
 * - Returns `0n` on invalid input.
 *
 * @param isoString ISO 8601 instant (zoned column) or plain date-time (zoneless column)
 * @param options the Arrow column's timestamp type
 * @returns the `int64` count since 1970-01-01 in the column's unit, or `0n` on invalid input
 *
 * @example toArrowTimestamp("2024-01-01T00:00:00Z", { unit: "millisecond", timeZone: "UTC" }) // 1704067200000n
 * @example toArrowTimestamp("2024-01-01T09:00:00+09:00[Asia/Tokyo]", { unit: "second", timeZone: "Asia/Tokyo" }) // 1704067200n
 * @example toArrowTimestamp("2024-01-01T00:00:00", { unit: "millisecond" }) // 1704067200000n
 * @example toArrowTimestamp("2024-01-01T00:00:00.123456789Z", { unit: "microsecond", timeZone: "UTC" }) // 1704067200123456n — floors
 * @example toArrowTimestamp("1969-12-31T23:59:59.9999999Z", { unit: "microsecond", timeZone: "UTC" }) // -1n — toward negative infinity
 * @example toArrowTimestamp("2262-04-11T23:47:16.854775807Z", { unit: "nanosecond", timeZone: "UTC" }) // 9223372036854775807n
 * @example toArrowTimestamp("2262-04-11T23:47:16.854775808Z", { unit: "nanosecond", timeZone: "UTC" }) // 0n — past int64
 * @example toArrowTimestamp("2024-01-01T00:00:00Z", { unit: "millisecond" }) // 0n — an instant into a zoneless column
 * @example toArrowTimestamp("2024-01-01T00:00:00", { unit: "millisecond", timeZone: "UTC" }) // 0n — a wall time into a zoned column
 * @example toArrowTimestamp("2024-01-01T00:00:00Z", { unit: "ms", timeZone: "UTC" }) // 0n — not an Arrow unit
 */
export function toArrowTimestamp(
  isoString: string,
  options: ArrowTimestampOptions,
): bigint {
  const resolved = resolveArrowTimestampOptions(options);

  if (resolved === null) {
    return 0n;
  }

  const nanoseconds = resolved.zoned
    ? parseInstantNanoseconds(isoString)
    : wallClockNanoseconds(isoString);

  if (nanoseconds === null || !isValidEpochNanoseconds(nanoseconds)) {
    return 0n;
  }

  const result = floorDivide(nanoseconds, resolved.factor);

  return result < MIN_INT64 || result > MAX_INT64 ? 0n : result;
}

/** The wall time read "as if" UTC (Arrow Schema.fbs), or `null` when it is not a plain date-time. */
function wallClockNanoseconds(isoString: string): bigint | null {
  if (typeof isoString !== "string" || !isValidDateTime(isoString)) {
    return null;
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(isoString);

    return (
      BigInt(epochDayOf(dateTime.year, dateTime.month, dateTime.day)) *
        NANOSECONDS_PER_DAY +
      BigInt(dateTime.hour) * 3_600_000_000_000n +
      BigInt(dateTime.minute) * 60_000_000_000n +
      BigInt(dateTime.second) * 1_000_000_000n +
      BigInt(dateTime.millisecond) * 1_000_000n +
      BigInt(dateTime.microsecond) * 1_000n +
      BigInt(dateTime.nanosecond)
    );
  } catch {
    return null;
  }
}
