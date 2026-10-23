import {
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_SECOND,
  PROTO_DURATION_MAX_SECONDS,
  readProtoRecord,
} from "../../internal";
import { Temporal } from "../../internal/temporal";
import type { ProtoDuration } from "./toProtoDuration";

const NANOSECONDS_PER_MINUTE = 60n * NANOSECONDS_PER_SECOND;
const NANOSECONDS_PER_HOUR = 60n * NANOSECONDS_PER_MINUTE;

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
    seconds > PROTO_DURATION_MAX_SECONDS ||
    // duration.proto: a non-zero nanos "must be of the same sign as the seconds field".
    (seconds !== 0n && nanos !== 0 && seconds < 0n !== nanos < 0)
  ) {
    return "";
  }

  const total = seconds * NANOSECONDS_PER_SECOND + BigInt(nanos);
  const negative = total < 0n;
  const magnitude = negative ? -total : total;
  const sign = negative ? -1 : 1;

  try {
    return Temporal.Duration.from({
      hours: sign * Number(magnitude / NANOSECONDS_PER_HOUR),
      minutes:
        sign *
        Number((magnitude % NANOSECONDS_PER_HOUR) / NANOSECONDS_PER_MINUTE),
      seconds:
        sign *
        Number((magnitude % NANOSECONDS_PER_MINUTE) / NANOSECONDS_PER_SECOND),
      milliseconds:
        sign *
        Number(
          (magnitude % NANOSECONDS_PER_SECOND) / NANOSECONDS_PER_MILLISECOND,
        ),
      microseconds:
        sign *
        Number(
          (magnitude % NANOSECONDS_PER_MILLISECOND) /
            NANOSECONDS_PER_MICROSECOND,
        ),
      nanoseconds: sign * Number(magnitude % NANOSECONDS_PER_MICROSECOND),
    }).toString();
  } catch {
    return "";
  }
}
