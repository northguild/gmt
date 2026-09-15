import { Temporal } from "@js-temporal/polyfill";
import {
  NANOSECONDS_PER_MICROSECOND,
  NANOSECONDS_PER_MILLISECOND,
  NANOSECONDS_PER_SECOND,
} from "./foreignEpochs";

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60_000_000_000n;

/**
 * Format a non-negative count of nanoseconds as an ISO 8601 duration with hours as the largest
 * unit — the string `Temporal.Instant.prototype.until(…, { largestUnit: "hour" }).toString()`
 * produces for a span of that length. Returns "" for a negative count or if Temporal throws.
 *
 * - Splits with bigint division, so it stays exact past 2^53 ns and across the full Instant
 *   span (1.728 × 10^22 ns = 4 800 000 000 h, which `Number` holds exactly).
 *
 * @param nanoseconds non-negative elapsed nanoseconds
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example formatHourDuration(0n) // "PT0S"
 * @example formatHourDuration(178200000000001n) // "PT49H30M0.000000001S"
 * @example formatHourDuration(-1n) // ""
 */
export function formatHourDuration(nanoseconds: bigint): string {
  if (nanoseconds < 0n) {
    return "";
  }

  const hours = nanoseconds / NANOSECONDS_PER_HOUR;
  const afterHours = nanoseconds % NANOSECONDS_PER_HOUR;
  const minutes = afterHours / NANOSECONDS_PER_MINUTE;
  const afterMinutes = afterHours % NANOSECONDS_PER_MINUTE;
  const seconds = afterMinutes / NANOSECONDS_PER_SECOND;
  const afterSeconds = afterMinutes % NANOSECONDS_PER_SECOND;
  const milliseconds = afterSeconds / NANOSECONDS_PER_MILLISECOND;
  const afterMilliseconds = afterSeconds % NANOSECONDS_PER_MILLISECOND;
  const microseconds = afterMilliseconds / NANOSECONDS_PER_MICROSECOND;
  const remainder = afterMilliseconds % NANOSECONDS_PER_MICROSECOND;

  try {
    return Temporal.Duration.from({
      hours: Number(hours),
      minutes: Number(minutes),
      seconds: Number(seconds),
      milliseconds: Number(milliseconds),
      microseconds: Number(microseconds),
      nanoseconds: Number(remainder),
    }).toString();
  } catch {
    return "";
  }
}
