import { Temporal } from "@js-temporal/polyfill";
import {
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_SECOND,
} from "./foreignEpochs";

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60_000_000_000n;

/**
 * An ISO 8601 duration as exact elapsed nanoseconds, signed, or `null` when it is not one.
 *
 * The transport rule for a span of exact time (`transitTime`, `classifyPunctuality`,
 * `nextDeparture`, …):
 *
 * - Hours, minutes, seconds and fractions are elapsed time, and a day is 24 hours exactly. That
 *   is how TC39 Temporal's `Duration.prototype.round` and `total` read a day when no
 *   `relativeTo` is given.
 * - Years, months and weeks return `null`: `round` and `total` require a `relativeTo` for them,
 *   so they have no exact length on their own. A zero calendar component (`P0Y1D`) changes
 *   nothing. (`Temporal.Instant#add` accepts no date unit at all, days included; callers add the
 *   nanoseconds this returns instead.)
 * - The result keeps the duration's sign, so a caller that needs a non-negative amount checks
 *   `< 0n` itself. `-PT0S` is `0n`.
 * - Summed in bigint, so it stays exact past 2^53 ns and across the whole instant range.
 *
 * @param value candidate ISO 8601 duration string
 * @returns the duration in nanoseconds, negative for a negative duration, or null on invalid input
 *
 * @example exactDurationNanoseconds("PT1H") // 3600000000000n
 * @example exactDurationNanoseconds("-PT5M") // -300000000000n
 * @example exactDurationNanoseconds("P1D") // 86400000000000n
 * @example exactDurationNanoseconds("P1W") // null
 */
export function exactDurationNanoseconds(value: unknown): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const duration = Temporal.Duration.from(value);
    if (duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0) {
      return null;
    }

    return (
      BigInt(duration.days) * NANOSECONDS_PER_DAY +
      BigInt(duration.hours) * NANOSECONDS_PER_HOUR +
      BigInt(duration.minutes) * NANOSECONDS_PER_MINUTE +
      BigInt(duration.seconds) * NANOSECONDS_PER_SECOND +
      BigInt(duration.milliseconds) * NANOSECONDS_PER_MILLISECOND +
      BigInt(duration.microseconds) * NANOSECONDS_PER_MICROSECOND +
      BigInt(duration.nanoseconds)
    );
  } catch {
    return null;
  }
}

/**
 * `exactDurationNanoseconds` for an amount that may not be negative — a tolerance, a minimum
 * connection — or `null`. Zero is allowed, and `-PT0S` is zero.
 *
 * @param value candidate ISO 8601 duration string
 * @returns the duration in nanoseconds, zero or more, or null on invalid input or a negative duration
 *
 * @example nonNegativeExactDurationNanoseconds("PT15M") // 900000000000n
 * @example nonNegativeExactDurationNanoseconds("-PT15M") // null
 */
export function nonNegativeExactDurationNanoseconds(
  value: unknown,
): bigint | null {
  const nanoseconds = exactDurationNanoseconds(value);
  return nanoseconds === null || nanoseconds < 0n ? null : nanoseconds;
}
