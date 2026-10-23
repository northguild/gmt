import {
  NANOSECONDS_PER_SECOND,
  PROTO_TIMESTAMP_MAX_SECONDS,
  PROTO_TIMESTAMP_MIN_SECONDS,
  readProtoRecord,
  instantStringFromEpochNanoseconds,
} from "../../internal";
import type { ProtoTimestamp } from "./toProtoTimestamp";

/**
 * Convert a protobuf `google.protobuf.Timestamp` record back to an ISO 8601 instant string.
 *
 * - `seconds` is a `bigint` or a safe-integer `number` (protobufjs and ts-proto emit `int64` as a
 *   number by default). A string, an unsafe number or a fraction is invalid.
 * - `nanos` is an integer `number` in `[0, 999999999]` and counts **forward** in time, also when
 *   `seconds` is negative: write `{ seconds: -1n, nanos: 500000000 }` for half a second before 1970,
 *   not a negative `nanos`, which is invalid. A `bigint` `nanos` is invalid.
 * - Both members are required. A missing member is a malformed record, not proto3's default zero.
 * - `seconds` must be in `[-62135596800, 253402300799]` (0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z).
 * - Returns "" on invalid input, and never throws, a hostile record included.
 *
 * @param value A `{ seconds, nanos }` record
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromProtoTimestamp({ seconds: 0n, nanos: 0 }) // "1970-01-01T00:00:00Z"
 * @example fromProtoTimestamp({ seconds: -1n, nanos: 500000000 }) // "1969-12-31T23:59:59.5Z"
 * @example fromProtoTimestamp({ seconds: 1710074096n, nanos: 789000000 }) // "2024-03-10T12:34:56.789Z"
 * @example fromProtoTimestamp({ seconds: 1710074096, nanos: 789000000 }) // "2024-03-10T12:34:56.789Z" — number seconds
 * @example fromProtoTimestamp({ seconds: -62135596800n, nanos: 0 }) // "0001-01-01T00:00:00Z"
 * @example fromProtoTimestamp({ seconds: 253402300799n, nanos: 999999999 }) // "9999-12-31T23:59:59.999999999Z"
 * @example fromProtoTimestamp({ seconds: 253402300800n, nanos: 0 }) // "" — past the protobuf range
 * @example fromProtoTimestamp({ seconds: 0n, nanos: -1 }) // "" — negative nanos; write { seconds: -1n, nanos: 999999999 }
 * @example fromProtoTimestamp({ seconds: 0n }) // "" — missing nanos
 */
export function fromProtoTimestamp(
  value: ProtoTimestamp | { seconds: number; nanos: number },
): string {
  const record = readProtoRecord(value);

  if (record === null) {
    return "";
  }

  const { seconds, nanos } = record;

  if (
    nanos < 0 ||
    nanos > 999_999_999 ||
    seconds < PROTO_TIMESTAMP_MIN_SECONDS ||
    seconds > PROTO_TIMESTAMP_MAX_SECONDS
  ) {
    return "";
  }

  return instantStringFromEpochNanoseconds(
    seconds * NANOSECONDS_PER_SECOND + BigInt(nanos),
  );
}
