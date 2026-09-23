import { parseIntervalNanoseconds } from "../../internal";
import type { Interval } from "../../types";

/**
 * Validate whether a value is an `Interval` the `interval/` namespace accepts.
 *
 * - True when `start` and `end` are ISO 8601 instant strings (offset required, no leap second)
 *   and `start` is not after `end`.
 * - Annotations are read as `Temporal.Instant.from` reads them: a bracketed zone, a calendar
 *   annotation (`[u-ca=hebrew]`, critical or not) and an elective unknown annotation
 *   (`[foo=bar]`) are ignored; an unknown critical annotation (`[!foo=bar]`) is rejected.
 * - Compares instants, not text: `{ start: "2024-01-01T10:00:00+01:00", end: "2024-01-01T09:30:00Z" }`
 *   is valid even though it sorts backwards as a string.
 * - `start === end` is valid — an empty interval.
 * - Use it to tell a legitimate `[]` from `mergeIntervals`, `subtractIntervals` or
 *   `splitIntervalAt` apart from their invalid-input sentinel, which is also `[]`.
 * - Returns `false` for non-objects, `null`, and records whose `start`/`end` are not strings.
 *
 * @param interval candidate `{ start, end }` record of ISO 8601 instant strings
 * @returns boolean indicating whether every `interval/` function accepts it
 *
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // true
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }) // true — empty
 * @example isValidInterval({ start: "2024-01-01T10:00:00+01:00", end: "2024-01-01T09:30:00Z" }) // true — 09:00Z to 09:30Z
 * @example isValidInterval({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }) // false — inverted
 * @example isValidInterval({ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }) // false — no offset
 * @example isValidInterval({ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }) // false — leap second
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: "2024-01-01T17:00:00Z" }) // true — calendar annotation ignored
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z[!foo=bar]", end: "2024-01-01T17:00:00Z" }) // false — unknown critical annotation
 */
export function isValidInterval(interval: Interval): boolean {
  try {
    return parseIntervalNanoseconds(interval) !== null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
