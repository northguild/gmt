import { spanNanoseconds } from "../../internal/instantNanoseconds";

/** Nanoseconds in a millisecond. */
const NANOSECONDS_PER_MILLISECOND = 1_000_000n;

/**
 * The largest span, in nanoseconds, whose exact millisecond value a `number` still holds.
 *
 * Guarding here rather than on the truncated whole-millisecond part matters: a span of
 * `MAX_SAFE_INTEGER` milliseconds *plus* a fraction passes a whole-millisecond check and
 * then rounds up to 2^53 on recombination, returning an unsafe integer from a function
 * documented to return the sentinel past the safe range.
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
 * - Accepts anything `toNanoseconds` does: the RFC 9557 instant grammar, no leap seconds. An
 *   offset designator (`Z`, `±HH:MM[:SS[.fraction]]`) is required and nothing follows it: a
 *   time zone, calendar or any other annotation returns `null`, so a zoned string is not an
 *   instant here (`spanWallClock` is the one that reads those). The offset alone fixes the
 *   instant, and one written with seconds is read exactly.
 * - Returns `null` on invalid input, not `0` — `0` is the span between an instant and itself.
 *   `null`, not `NaN`, because that is GMT's sentinel for every number-returning function:
 *   it is the one a caller already checks for, and the only one `strictNullChecks` forces
 *   them to handle. A `NaN` would type as plain `number` and propagate silently through
 *   arithmetic. `spanNs` and `spanWallClock` return `null` for the same reason.
 * - **Safe range.** Returns `null` when the exact span exceeds `Number.MAX_SAFE_INTEGER`
 *   milliseconds (±9_007_199_254_740_991 ms, about ±285,000 years), which two instants at
 *   opposite ends of `Temporal.Instant`'s range do. A sub-millisecond fraction counts
 *   toward that ceiling, so any number returned is a safe integer or below. Use `spanNs`
 *   past it — it carries the exact value as a `bigint`.
 *   Sub-millisecond fidelity goes first, long before the ceiling: a double carries the
 *   nanosecond digits exactly only while the span is under 2^53 ns, roughly 104 days.
 * - Leap seconds are not counted. UTC repeats a second rather than numbering a 61st one, so
 *   a span across one is a second short of the physical elapsed time; against a smeared
 *   clock (Google, AWS, Meta) the error is up to a second spread over the smear window.
 *   For a leap-second-exact span, convert both ends with `toTAI` or add
 *   `leapSecondsBetween(start, end)` seconds, both from `timescale/`.
 *
 * @param start ISO 8601 instant string the span is measured from
 * @param end ISO 8601 instant string the span is measured to
 * @returns exact elapsed milliseconds, negative when start is after end, or null on invalid input
 *
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z") // 1000
 * @example spanMs("2024-03-10T12:00:01Z", "2024-03-10T12:00:00Z") // -1000
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00Z") // 0
 * @example spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00.123456789Z") // 123.456789
 * @example spanMs("2024-03-30T12:00:00+00:00", "2024-03-31T12:00:00+01:00") // 82800000 — 23 hours, not 24
 * @example spanMs("2024-03-10T12:00:00+05:00", "2024-03-10T12:00:00-04:00") // 32400000 — the offsets decide
 * @example spanMs("1960-01-01T01:04:30Z", "1960-01-01T00:20:00-00:44:30") // 0 — an offset with seconds is read exactly
 * @example spanMs("-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z") // null — past the safe integer range, use spanNs
 * @example spanMs("2024-03-10T12:00:00Z", "invalid") // null
 */
export function spanMs(start: string, end: string): number | null {
  const nanoseconds = spanNanoseconds(start, end);

  if (nanoseconds === null) {
    return null;
  }

  if (
    nanoseconds > MAX_SAFE_NANOSECONDS ||
    nanoseconds < -MAX_SAFE_NANOSECONDS
  ) {
    return null;
  }

  // Split rather than dividing the whole bigint through a double: Number(nanoseconds) is
  // already lossy past 2^53 ns (~104 days), which would corrupt the millisecond part too.
  // BigInt division truncates toward zero and `%` keeps the dividend's sign, so both halves
  // flip together and spanMs(b, a) === -spanMs(a, b) holds exactly.
  const milliseconds = nanoseconds / NANOSECONDS_PER_MILLISECOND;
  const remainder = nanoseconds % NANOSECONDS_PER_MILLISECOND;

  return Number(milliseconds) + Number(remainder) / 1e6;
}
