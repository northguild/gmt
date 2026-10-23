import {
  exactDurationNanoseconds,
  NANOSECONDS_PER_SECOND,
  PROTO_DURATION_MAX_SECONDS,
} from "../../internal";

/**
 * A protobuf `google.protobuf.Duration` as protobuf libraries expose it.
 */
export interface ProtoDuration {
  /**
   * Whole seconds (an `int64`), in `[-315576000000n, 315576000000n]` (about ±10,000 years).
   */
  seconds: bigint;
  /**
   * Nanoseconds, an integer in `[-999999999, 999999999]`. When `seconds` is not zero, `nanos` is
   * zero or has the same sign as `seconds`.
   */
  nanos: number;
}

/**
 * Convert an ISO 8601 duration string to a protobuf `google.protobuf.Duration` record.
 *
 * - **Same sign.** Unlike `Timestamp`, a negative `Duration` has a negative `nanos` too:
 *   `-PT1.5S` is `{ seconds: -1n, nanos: -500000000 }`, not `{ seconds: -2n, nanos: 500000000 }`.
 * - A day is exactly 24 hours, as TC39 Temporal reads a day without a `relativeTo`; protobuf has
 *   no day unit. `P1D` is 86400 seconds.
 * - Years, months and weeks have no fixed length and return `null`.
 * - Exact: nothing is rounded. `seconds` is a `bigint` (`int64`); `seconds` beyond ±315576000000,
 *   the range `duration.proto` states, returns `null`. `seconds` and `nanos` are bounded separately.
 * - Returns `null` on invalid input.
 *
 * @param isoDuration ISO 8601 duration string (e.g. "PT1H30M1.5S")
 * @returns `{ seconds, nanos }`, or `null` on invalid input
 *
 * @example toProtoDuration("PT1H30M1.5S") // { seconds: 5401n, nanos: 500000000 }
 * @example toProtoDuration("-PT1.5S") // { seconds: -1n, nanos: -500000000 } — nanos take seconds' sign
 * @example toProtoDuration("-PT0.5S") // { seconds: 0n, nanos: -500000000 }
 * @example toProtoDuration("P1D") // { seconds: 86400n, nanos: 0 } — a day is 24 hours
 * @example toProtoDuration("PT0S") // { seconds: 0n, nanos: 0 }
 * @example toProtoDuration("PT315576000000S") // { seconds: 315576000000n, nanos: 0 }
 * @example toProtoDuration("PT315576000000.000000001S") // { seconds: 315576000000n, nanos: 1 } — seconds and nanos are bounded separately
 * @example toProtoDuration("PT315576000001S") // null — seconds past the protobuf range
 * @example toProtoDuration("P1M") // null — a month has no fixed length
 * @example toProtoDuration("invalid") // null
 */
export function toProtoDuration(isoDuration: string): ProtoDuration | null {
  const nanoseconds = exactDurationNanoseconds(isoDuration);

  if (nanoseconds === null) {
    return null;
  }

  // BigInt division truncates toward zero, so the remainder keeps the sign of the whole
  // (duration.proto: nanos "must be of the same sign as the seconds field").
  const seconds = nanoseconds / NANOSECONDS_PER_SECOND;

  // duration.proto: seconds "Must be from -315,576,000,000 to +315,576,000,000 inclusive".
  if (
    seconds < -PROTO_DURATION_MAX_SECONDS ||
    seconds > PROTO_DURATION_MAX_SECONDS
  ) {
    return null;
  }

  return {
    seconds,
    nanos: Number(nanoseconds % NANOSECONDS_PER_SECOND),
  };
}
