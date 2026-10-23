import { NANOSECONDS_PER_MILLISECOND } from "./foreignEpochs";
import { floorDivide } from "./floorDivide";
import { parseInstantNanoseconds } from "./instantNanoseconds";

/** 2^48 ms: one past the last 48-bit Unix millisecond, the exclusive end of an identifier range. */
export const UNIX_MS_48_END = 2n ** 48n;

/**
 * The core of `uuidV7TimestampPrefix` and `ulidTimestampPrefix`: parse an instant, floor it to
 * the millisecond and range-check it against the 48-bit Unix millisecond field. Returns `null`
 * for an invalid instant, one before 1970-01-01, or one past 2^48 ms. The result may be
 * 2^48 itself, which no identifier carries; a caller that cannot write it rejects it.
 */
export function prefixMilliseconds(isoString: string): bigint | null {
  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return null;
  }

  const milliseconds = floorDivide(nanoseconds, NANOSECONDS_PER_MILLISECOND);

  return milliseconds < 0n || milliseconds > UNIX_MS_48_END
    ? null
    : milliseconds;
}
