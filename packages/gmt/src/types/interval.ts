/**
 * A span of time between two ISO 8601 instant strings, half-open: `[start, end)`.
 *
 * - An instant `t` is inside when `start ≤ t < end` (EWD831; SQL:2011 closed-open `PERIOD`;
 *   RFC 5545 `DTEND` is non-inclusive). Intervals that touch share no instant.
 * - Both endpoints are instants: an offset (`Z`, `±HH:MM`) is required, a bracketed IANA zone is
 *   optional, and the two may name different zones. Leap seconds are rejected; a `[u-ca=...]`
 *   annotation is ignored, as `Temporal.Instant.from` ignores it. The offset fixes the instant;
 *   an offset written to the minute that is the bracketed zone's sub-minute offset rounded
 *   (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the zone gives.
 * - `start === end` (as instants) is a valid, empty interval: it has a position but contains no
 *   instant. `start` after `end` is invalid.
 *
 * Narrow a candidate with `isValidInterval`. Used by the `interval/` namespace; the older
 * `plain|utc|zoned|unix/interval` functions take positional strings and a different model.
 */
export type Interval = {
  /** The first instant inside the interval, as an ISO 8601 instant string with an offset. */
  start: string;
  /**
   * The first instant after the interval, as an ISO 8601 instant string with an offset; it is
   * not itself inside. It may equal `start`, which makes the interval empty, but not precede it.
   */
  end: string;
};
