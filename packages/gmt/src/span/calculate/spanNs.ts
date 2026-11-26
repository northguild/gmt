import { spanNanoseconds } from "../../internal/instantNanoseconds";

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
 * - Accepts anything `toNanoseconds` does: the RFC 9557 instant grammar, no leap seconds. An
 *   offset designator (`Z`, `±HH:MM[:SS[.fraction]]`) is required and nothing follows it: a
 *   time zone, calendar or any other annotation returns `null`, so a zoned string is not an
 *   instant here (`spanWallClock` is the one that reads those). The offset alone fixes the
 *   instant, and one written with seconds is read exactly.
 * - Returns `null` on invalid input, not `0n` — `0n` is the span between an instant and
 *   itself. This is why it does not simply subtract two `toNanoseconds` results, which
 *   return `0n` for both the epoch and a rejected string.
 * - The result is a **duration**, not an instant: it ranges up to
 *   ±17_280_000_000_000_000_000_000n, twice what `Temporal.Instant` can represent. Do not
 *   feed it to `fromNanoseconds`.
 * - Leap seconds are not counted. UTC repeats a second rather than numbering a 61st one, so
 *   a span across one is a second short of the physical elapsed time; against a smeared
 *   clock (Google, AWS, Meta) the error is up to a second spread over the smear window.
 *   For a leap-second-exact span, convert both ends with `toTAI` or add
 *   `leapSecondsBetween(start, end)` seconds, both from `timescale/`.
 *
 * @param start ISO 8601 instant string the span is measured from
 * @param end ISO 8601 instant string the span is measured to
 * @returns exact elapsed nanoseconds as a bigint, negative when start is after end, or null on invalid input
 *
 * @example spanNs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z") // 1000000000n
 * @example spanNs("2024-03-10T12:00:01Z", "2024-03-10T12:00:00Z") // -1000000000n
 * @example spanNs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00Z") // 0n
 * @example spanNs("2024-03-10T12:00:00.123456789Z", "2024-03-10T12:00:00.123456790Z") // 1n
 * @example spanNs("2024-03-10T07:00:00-05:00", "2024-03-10T12:00:00Z") // 0n — same instant, different offsets
 * @example spanNs("2024-03-10T12:00:00+05:00", "2024-03-10T12:00:00-04:00") // 32400000000000n — the offsets decide
 * @example spanNs("1960-01-01T01:04:30Z", "1960-01-01T00:20:00-00:44:30") // 0n — an offset with seconds is read exactly
 * @example spanNs("2024-03-10T12:00:00Z", "invalid") // null
 */
export function spanNs(start: string, end: string): bigint | null {
  return spanNanoseconds(start, end);
}
