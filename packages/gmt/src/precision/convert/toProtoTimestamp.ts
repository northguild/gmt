import {
  floorDivide,
  NANOSECONDS_PER_SECOND,
  parseInstantNanoseconds,
  PROTO_TIMESTAMP_MAX_SECONDS,
  PROTO_TIMESTAMP_MIN_SECONDS,
} from "../../internal";

/**
 * A protobuf `google.protobuf.Timestamp` as protobuf libraries expose it.
 */
export interface ProtoTimestamp {
  /**
   * Whole seconds since 1970-01-01T00:00:00Z (an `int64`), in
   * `[-62135596800n, 253402300799n]`: 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z.
   */
  seconds: bigint;
  /**
   * Nanoseconds of the second, an integer in `[0, 999999999]`. It counts forward in time even
   * when `seconds` is negative.
   */
  nanos: number;
}

/**
 * Convert an ISO 8601 instant string to a protobuf `google.protobuf.Timestamp` record.
 *
 * - `nanos` always counts **forward** from `seconds`, also for instants before the epoch: half a
 *   second before 1970 is `{ seconds: -1n, nanos: 500000000 }`, never `{ seconds: 0n, nanos: -500000000 }`.
 * - Exact: nothing is rounded. An offset or zone in the input is applied first.
 * - `seconds` is a `bigint` (`int64`). The range is the one `timestamp.proto` states,
 *   0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z; an instant outside it returns `null`.
 * - A leap second (`23:59:60`) is invalid: protobuf smears leap seconds, so it has no value here.
 * - Returns `null` on invalid input.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:34:56.789Z")
 * @returns `{ seconds, nanos }`, or `null` on invalid input
 *
 * @example toProtoTimestamp("1970-01-01T00:00:00Z") // { seconds: 0n, nanos: 0 }
 * @example toProtoTimestamp("1969-12-31T23:59:59.5Z") // { seconds: -1n, nanos: 500000000 } — nanos count forward
 * @example toProtoTimestamp("2024-03-10T12:34:56.789Z") // { seconds: 1710074096n, nanos: 789000000 }
 * @example toProtoTimestamp("2024-03-10T13:34:56.789+01:00[Europe/Paris]") // { seconds: 1710074096n, nanos: 789000000 }
 * @example toProtoTimestamp("0001-01-01T00:00:00Z") // { seconds: -62135596800n, nanos: 0 }
 * @example toProtoTimestamp("9999-12-31T23:59:59.999999999Z") // { seconds: 253402300799n, nanos: 999999999 }
 * @example toProtoTimestamp("+010000-01-01T00:00:00Z") // null — past the protobuf range
 * @example toProtoTimestamp("2016-12-31T23:59:60Z") // null — leap second
 * @example toProtoTimestamp("2024-03-10T12:34:56") // null — no offset designator
 * @example toProtoTimestamp("invalid") // null
 */
export function toProtoTimestamp(isoString: string): ProtoTimestamp | null {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return null;
  }

  // Floor division keeps nanos in [0, 999999999] for negative seconds (timestamp.proto).
  const seconds = floorDivide(nanoseconds, NANOSECONDS_PER_SECOND);

  // timestamp.proto: seconds "Must be between -62135596800 and 253402300799 inclusive".
  if (
    seconds < PROTO_TIMESTAMP_MIN_SECONDS ||
    seconds > PROTO_TIMESTAMP_MAX_SECONDS
  ) {
    return null;
  }

  return {
    seconds,
    nanos: Number(nanoseconds - seconds * NANOSECONDS_PER_SECOND),
  };
}
