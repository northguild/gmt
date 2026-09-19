import {
  coalesceIntervalNanoseconds,
  parseIntervalNanoseconds,
  parseIntervalNanosecondsList,
} from "../../internal";
import type { Interval } from "../../types";

/**
 * Return the parts of `from` that no interval in `remove` covers, as sorted half-open intervals.
 *
 * - A removal strictly inside `from` splits it in two; one covering an edge trims it; one
 *   covering all of it leaves `[]`.
 * - Half-open: a removal that only touches `from` removes nothing, and pieces never include an
 *   instant any removal covers.
 * - `remove` may be unsorted and overlapping. Removing an empty interval changes nothing;
 *   subtracting from an empty `from` returns `[]`.
 * - Endpoints are the caller's own strings, and `from`'s spelling is kept wherever `from` and a
 *   removal name the same instant (GMT rule).
 * - `[]` is both a legitimate result (everything removed) and the invalid-input sentinel; check
 *   inputs with `isValidInterval` when the difference matters.
 * - The positional `intervalDifferenceUtc` (…) follow the same half-open rule for a single
 *   removal: pieces end exactly where the removal starts.
 * - For zone-aligned removals (non-working local days), build them with `floorToZone` first.
 * - Returns `[]` when `from` is not a valid `Interval`, `remove` is not an array, or any element
 *   of `remove` is not a valid `Interval` — even one outside `from`.
 *
 * @param from `{ start, end }` record of ISO 8601 instant strings to subtract from
 * @param remove array of `{ start, end }` records of ISO 8601 instant strings to remove
 * @returns sorted, non-touching `{ start, end }` records of what remains, or [] on invalid input
 *
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — touching
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T08:00:00Z", end: "2024-01-01T18:00:00Z" }]) // [] — fully covered
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, []) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T12:00:00Z", end: "2016-12-31T23:59:60Z" }]) // [] — invalid removal
 */
export function subtractIntervals(
  from: Interval,
  remove: Interval[],
): Interval[] {
  const source = parseIntervalNanoseconds(from);
  const removals = parseIntervalNanosecondsList(remove);

  if (source === null || removals === null) {
    return [];
  }

  const pieces: Interval[] = [];
  let cursor = source.start;
  let cursorText = source.startText;

  for (const removal of coalesceIntervalNanoseconds(removals)) {
    if (cursor >= source.end || removal.start >= source.end) {
      break;
    }

    if (removal.end <= cursor) {
      continue;
    }

    if (removal.start > cursor) {
      pieces.push({ start: cursorText, end: removal.startText });
    }

    cursor = removal.end;
    cursorText = removal.endText;
  }

  if (cursor < source.end) {
    pieces.push({ start: cursorText, end: source.endText });
  }

  return pieces;
}
