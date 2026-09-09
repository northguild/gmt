import { spanNs } from "./spanNs";

/** Nanoseconds in a millisecond. */
const NANOSECONDS_PER_MILLISECOND = 1_000_000n;

/**
 * The largest span, in nanoseconds, whose exact millisecond value a `number` still holds.
 *
 * Guarding here rather than on the truncated whole-millisecond part matters: a span of
 * `MAX_SAFE_INTEGER` milliseconds *plus* a fraction passes a whole-millisecond check and
 * then rounds up to 2^53 on recombination, returning an unsafe integer from a function
 * documented to return NaN past the safe range.
 */
const MAX_SAFE_NANOSECONDS =
  BigInt(Number.MAX_SAFE_INTEGER) * NANOSECONDS_PER_MILLISECOND;

/**
 * Return the exact elapsed milliseconds between two ISO 8601 instant strings.
 *
 * The universal span primitive for profiling and observability. Fractional, like
 * `performance.now()` — a sub-millisecond span is reported as a fraction, not rounded away.
 *
 * - Signed: negative when `start` is after `end`, so `spanMs(b, a)` is exactly
 *   `-spanMs(a, b)`.
 * - Measures **exact elapsed time**, never calendar distance. A wall-clock day containing a
 *   DST transition is 23 or 25 hours (or 24.5, in `Australia/Lord_Howe`), and `spanMs`
 *   reports the hours that actually elapsed. `spanWallClock` answers the calendar question;
 *   conflating the two is the most common span bug there is.
 * - Accepts anything `toNanoseconds` does: the full RFC 9557 instant grammar, no leap
 *   seconds, no `[u-ca=...]` calendar annotation. An offset designator (`Z`, `±HH:MM`) is
 *   required, optionally followed by a bracketed IANA zone — a bracket alone is not enough,
 *   which is the one string shape `spanWallClock` accepts and these two do not. The
 *   endpoints need not share a zone; an instant is an instant.
 * - Returns `NaN` on invalid input, not `0` — `0` is the span between an instant and itself.
 * - **Safe range.** Returns `NaN` when the exact span exceeds `Number.MAX_SAFE_INTEGER`
 *   milliseconds (±9_007_199_254_740_991 ms, about ±285,000 years), which two instants at
 *   opposite ends of `Temporal.Instant`'s range do. A sub-millisecond fraction counts
 *   toward that ceiling, so the returned number is always a safe integer or below. Use
 *   `spanNs` past it.
 *   Sub-millisecond fidelity goes first, long before the ceiling: a double carries the
 *   nanosecond digits exactly only while the span is under 2^53 ns, roughly 104 days.
 * - Leap seconds are not counted. UTC repeats a second rather than numbering a 61st one, so
 *   a span across one is a second short of the physical elapsed time; against a smeared
 *   clock (Google, AWS, Meta) the error is up to a second spread over the smear window.
 *   Leap-second-exact spans need a TAI scale, which GMT does not yet ship.
 *
 * @param start ISO 8601 instant string the span is measured from
 * @param end ISO 8601 instant string the span is measured to
 * @returns exact elapsed milliseconds, negative when start is after end, or NaN on invalid input
 *
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z") // 1000
 * @example spanMs("2024-03-10T12:00:01Z", "2024-03-10T12:00:00Z") // -1000
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00Z") // 0
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00.123456789Z") // 123.456789
 * @example spanMs("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]") // 82800000 — 23 hours, not 24
 * @example spanMs("-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z") // NaN — past the safe integer range, use spanNs
 * @example spanMs("2024-03-10T12:00:00Z", "invalid") // NaN
 */
export function spanMs(start: string, end: string): number {
  const nanoseconds = spanNs(start, end);

  if (nanoseconds === null) {
    return Number.NaN;
  }

  if (
    nanoseconds > MAX_SAFE_NANOSECONDS ||
    nanoseconds < -MAX_SAFE_NANOSECONDS
  ) {
    return Number.NaN;
  }

  // Split rather than dividing the whole bigint through a double: Number(nanoseconds) is
  // already lossy past 2^53 ns (~104 days), which would corrupt the millisecond part too.
  // BigInt division truncates toward zero and `%` keeps the dividend's sign, so both halves
  // flip together and spanMs(b, a) === -spanMs(a, b) holds exactly.
  const milliseconds = nanoseconds / NANOSECONDS_PER_MILLISECOND;
  const remainder = nanoseconds % NANOSECONDS_PER_MILLISECOND;

  return Number(milliseconds) + Number(remainder) / 1e6;
}
