import { PROTO_DURATION_MAX_SECONDS, readProtoRecord } from "../../internal";
import { Temporal } from "../../internal/temporal";
import type { ProtoDuration } from "./toProtoDuration";

/**
 * Convert a protobuf `google.protobuf.Duration` record back to an ISO 8601 duration string.
 *
 * - Hours are the largest unit, so the result is exact elapsed time and never a calendar day:
 *   86400 seconds is `PT24H`, not `P1D`.
 * - `seconds` is a `bigint` or a safe-integer `number` and must be within ±315576000000
 *   (`duration.proto`). `nanos` is an integer `number` in `[-999999999, 999999999]`.
 * - **Same sign.** When `seconds` and `nanos` are both non-zero they must have the same sign:
 *   `{ seconds: -1n, nanos: -500000000 }` is `-PT1.5S`, and `{ seconds: 1n, nanos: -1 }` is invalid.
 * - Both members are required. A missing member is a malformed record, not proto3's default zero.
 * - Returns "" on invalid input, and never throws, a hostile record included.
 *
 * @param value A `{ seconds, nanos }` record
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example fromProtoDuration({ seconds: 5401n, nanos: 500000000 }) // "PT1H30M1.5S"
 * @example fromProtoDuration({ seconds: -1n, nanos: -500000000 }) // "-PT1.5S"
 * @example fromProtoDuration({ seconds: 5401, nanos: 500000000 }) // "PT1H30M1.5S" — number seconds
 * @example fromProtoDuration({ seconds: 86400n, nanos: 0 }) // "PT24H" — no day unit
 * @example fromProtoDuration({ seconds: 0n, nanos: -1 }) // "-PT0.000000001S"
 * @example fromProtoDuration({ seconds: 0n, nanos: 0 }) // "PT0S"
 * @example fromProtoDuration({ seconds: 315576000000n, nanos: 0 }) // "PT87660000H"
 * @example fromProtoDuration({ seconds: 1n, nanos: -1 }) // "" — signs differ
 * @example fromProtoDuration({ seconds: 315576000001n, nanos: 0 }) // "" — past the protobuf range
 * @example fromProtoDuration({ seconds: 1n }) // "" — missing nanos
 */
export function fromProtoDuration(
  value: ProtoDuration | { seconds: number; nanos: number },
): string {
  const record = readProtoRecord(value);

  if (record === null) {
    return "";
  }

  const { seconds, nanos } = record;

  if (
    nanos < -999_999_999 ||
    nanos > 999_999_999 ||
    seconds < -PROTO_DURATION_MAX_SECONDS ||
    seconds > PROTO_DURATION_MAX_SECONDS
  ) {
    return "";
  }

  try {
    // duration.proto: a non-zero nanos "must be of the same sign as the seconds field";
    // `Temporal.Duration.from` rejects mixed signs (Temporal spec IsValidDuration), so it throws.
    // Balance into hours (never days: PT24H, not P1D); `round` keeps the sign and is exact.
    return Temporal.Duration.from({
      seconds: Number(seconds),
      nanoseconds: nanos,
    })
      .round({ largestUnit: "hours" })
      .toString();
  } catch {
    return "";
  }
}
