import { spanNs } from "./spanNs";

/** Nanoseconds in a second. */
const NANOSECONDS_PER_SECOND = 1_000_000_000n;

/**
 * Return the exact elapsed seconds between two ISO 8601 instant strings.
 *
 * The same contract as `spanMs`, in seconds: signed, fractional and unrounded.
 *
 * - Signed: negative when `start` is after `end`, so `spanSeconds(b, a)` is exactly
 *   `-spanSeconds(a, b)`.
 * - Measures **exact elapsed time**, never calendar distance, as `spanMs` does. A wall-clock
 *   day containing a DST transition is 23 or 25 hours, and the hours that elapsed are reported.
 *   `spanWallClock` answers the calendar question.
 * - Fractional and unrounded. For a wait that must not fall short, write `Math.ceil(n)`.
 * - Accepts the instant strings `spanMs` accepts: an offset designator (`Z`, `±HH:MM`) is
 *   required, optionally followed by a bracketed IANA zone.
 * - Returns `null` on invalid input, not `0`, which is the span between an instant and itself.
 * - Needs no safe-range guard: the widest possible span, 17_280_000_000_000 seconds, is well
 *   inside 2^53.
 * - Leap seconds are not counted (RFC 7519 section 2), as in `spanMs`.
 * - For the seconds left until a stored moment, use `secondsUntilHttpDate` or
 *   `secondsUntilUnix`.
 *
 * @param start ISO 8601 instant string the span is measured from
 * @param end ISO 8601 instant string the span is measured to
 * @returns exact elapsed seconds, negative when start is after end, or null on invalid input
 *
 * @example spanSeconds("2027-06-15T12:00:00Z", "2027-06-15T12:01:30Z") // 90
 * @example spanSeconds("2027-06-15T12:01:30Z", "2027-06-15T12:00:00Z") // -90
 * @example spanSeconds("2027-06-15T12:00:00Z", "2027-06-15T12:00:00.500Z") // 0.5
 * @example spanSeconds("2027-06-15T12:00:00Z", "2027-06-15T12:00:00Z") // 0
 * @example spanSeconds("2026-03-28T12:00:00+01:00[Europe/Paris]", "2026-03-29T12:00:00+02:00[Europe/Paris]") // 82800 — 23 hours, not 24
 * @example spanSeconds("2027-06-15T12:00:00Z", "soon") // null
 */
export function spanSeconds(start: string, end: string): number | null {
  const nanoseconds = spanNs(start, end);

  if (nanoseconds === null) {
    return null;
  }

  // Split so the whole part stays exact; BigInt `/` and `%` flip sign together.
  const seconds = nanoseconds / NANOSECONDS_PER_SECOND;
  const remainder = nanoseconds % NANOSECONDS_PER_SECOND;

  return Number(seconds) + Number(remainder) / 1e9;
}
