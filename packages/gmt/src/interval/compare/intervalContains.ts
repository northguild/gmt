import {
  parseInstantNanoseconds,
  parseIntervalNanoseconds,
} from "../../internal";
import type { Interval } from "../../types";

/**
 * Return true when an ISO 8601 instant string lies inside a half-open interval.
 *
 * - `start ≤ t < end`: `start` is inside, `end` is not.
 * - Always `false` for an empty interval (`start === end`) — it contains no instant.
 * - Compares instants: `isoString` may name a different zone from either endpoint.
 * - The closed `intervalContainsUtc`, `intervalContainsZoned` (…) include `end`; this is the
 *   half-open standard.
 * - Returns `false` on invalid input — `interval` not an `Interval`, or `isoString` not an
 *   instant string (offset required, no leap second, no `[u-ca=...]`).
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings
 * @param isoString ISO 8601 instant string to test
 * @returns true if the instant is inside the interval, or false on invalid input
 *
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T09:00:00Z") // true — start is inside
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T17:00:00Z") // false — end is not
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T04:00:00-05:00") // true — same instant as start
 * @example intervalContains({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, "2024-01-01T12:00:00Z") // false — empty interval
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T12:00:00") // false — no offset
 */
export function intervalContains(
  interval: Interval,
  isoString: string,
): boolean {
  const record = parseIntervalNanoseconds(interval);
  const instant = parseInstantNanoseconds(isoString);

  if (record === null || instant === null) {
    return false;
  }

  return record.start <= instant && instant < record.end;
}
