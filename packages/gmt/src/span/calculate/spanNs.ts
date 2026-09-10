import { parseInstantNanoseconds } from "../../internal";

/**
 * Return the exact elapsed nanoseconds between two ISO 8601 instant strings.
 *
 * The precise form of `spanMs`, and the one to reach for past a `number`'s safe range.
 *
 * - Signed: negative when `start` is after `end`, so `spanNs(b, a)` is exactly
 *   `-spanNs(a, b)`.
 * - Measures **exact elapsed time**, never calendar distance. Across a DST transition
 *   "one day later" and "24 hours later" are different spans — `spanWallClock` answers
 *   the calendar question.
 * - Accepts anything `toNanoseconds` does: the full RFC 9557 instant grammar, no leap
 *   seconds, no `[u-ca=...]` calendar annotation. An offset designator (`Z`, `±HH:MM`) is
 *   required, optionally followed by a bracketed IANA zone — a bracket alone is not enough,
 *   which is the one string shape `spanWallClock` accepts and these two do not. The
 *   endpoints need not share a zone; an instant is an instant.
 * - Returns `null` on invalid input, not `0n` — `0n` is the span between an instant and
 *   itself. This is why it does not simply subtract two `toNanoseconds` results, which
 *   return `0n` for both the epoch and a rejected string.
 * - The result is a **duration**, not an instant: it ranges up to
 *   ±17_280_000_000_000_000_000_000n, twice what `Temporal.Instant` can represent. Do not
 *   feed it to `fromNanoseconds`.
 * - Leap seconds are not counted. UTC repeats a second rather than numbering a 61st one, so
 *   a span across one is a second short of the physical elapsed time; against a smeared
 *   clock (Google, AWS, Meta) the error is up to a second spread over the smear window.
 *   Leap-second-exact spans need a TAI scale, which GMT does not yet ship.
 *
 * @param start ISO 8601 instant string the span is measured from
 * @param end ISO 8601 instant string the span is measured to
 * @returns exact elapsed nanoseconds as a bigint, negative when start is after end, or null on invalid input
 *
 * @example spanNs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z") // 1000000000n
 * @example spanNs("2024-03-10T12:00:01Z", "2024-03-10T12:00:00Z") // -1000000000n
 * @example spanNs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00Z") // 0n
 * @example spanNs("2024-03-10T12:00:00.123456789Z", "2024-03-10T12:00:00.123456790Z") // 1n
 * @example spanNs("2024-03-10T07:00:00-05:00[America/New_York]", "2024-03-10T12:00:00Z") // 0n — same instant, different zones
 * @example spanNs("2024-03-10T12:00:00Z", "invalid") // null
 */
export function spanNs(start: string, end: string): bigint | null {
  const startNanoseconds = parseInstantNanoseconds(start);
  const endNanoseconds = parseInstantNanoseconds(end);

  if (startNanoseconds === null || endNanoseconds === null) {
    return null;
  }

  return endNanoseconds - startNanoseconds;
}
