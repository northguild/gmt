import {
  parseInstantNanoseconds,
  parseIntervalNanoseconds,
} from "../../internal";
import type { Interval } from "../../types";

/**
 * Split a half-open interval at instant boundaries into consecutive half-open pieces.
 *
 * - Each piece's `end` is the next piece's `start`; under `[start, end)` the pieces share no
 *   instant and together cover the interval exactly once.
 * - `boundaries` may be unsorted. Boundaries at or outside the interval's edges are dropped, so
 *   no piece is empty; duplicate instants keep their first occurrence's spelling (GMT rule).
 * - Endpoints are the caller's own strings: the interval's own `start`/`end`, and each boundary
 *   exactly as passed.
 * - Splitting an empty interval returns it unchanged, as a single piece.
 * - Never returns `[]` for valid input — that is the invalid-input sentinel alone.
 * - To split at zone-aligned boundaries (local midnights), build them with `floorToZone` or
 *   `bucketRange` first.
 * - Returns `[]` when `interval` is not a valid `Interval`, `boundaries` is not an array, or any
 *   boundary is not an ISO 8601 instant string — even one outside the interval.
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings to split
 * @param boundaries array of ISO 8601 instant strings to split at
 * @returns consecutive `{ start, end }` pieces covering `interval`, or [] on invalid input
 *
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T12:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T15:00:00Z", "2024-01-01T11:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T11:00:00Z" }, { start: "2024-01-01T11:00:00Z", end: "2024-01-01T15:00:00Z" }, { start: "2024-01-01T15:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T09:00:00Z", "2024-01-01T18:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — edge and outside dropped
 * @example splitIntervalAt({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, ["2024-01-01T12:00:00Z"]) // [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }] — empty interval
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T12:00:00"]) // [] — no offset
 */
export function splitIntervalAt(
  interval: Interval,
  boundaries: string[],
): Interval[] {
  try {
    const record = parseIntervalNanoseconds(interval);

    if (record === null || !Array.isArray(boundaries)) {
      return [];
    }

    const inside: Array<{ instant: bigint; text: string }> = [];

    for (let index = 0; index < boundaries.length; index++) {
      const text = boundaries[index];
      const instant = parseInstantNanoseconds(text);

      if (instant === null) {
        return [];
      }

      if (record.start < instant && instant < record.end) {
        inside.push({ instant, text });
      }
    }

    // Array.prototype.sort is stable (ES2019): equal instants keep their input order.
    inside.sort((x, y) =>
      x.instant < y.instant ? -1 : x.instant > y.instant ? 1 : 0,
    );

    const texts = [record.startText];

    for (let index = 0; index < inside.length; index++) {
      if (index === 0 || inside[index].instant !== inside[index - 1].instant) {
        texts.push(inside[index].text);
      }
    }

    texts.push(record.endText);

    return texts
      .slice(0, -1)
      .map((start, index) => ({ start, end: texts[index + 1] }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
