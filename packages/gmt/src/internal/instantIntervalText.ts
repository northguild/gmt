import { Temporal } from "@js-temporal/polyfill";

/**
 * Re-serialise instant intervals to `Temporal.Instant.prototype.toString()` spelling.
 *
 * The CORE-6 `interval/` functions echo the caller's strings; the positional `utc/interval/`
 * functions that delegate to them return canonical `Z` strings instead (CORE-8 half-open decisions of record:
 * outputs stay re-serialised), so tie-breaks between spellings of one instant never surface.
 *
 * - Returns `null` if any string fails to parse (callers validate first, so only a throwing
 *   `Temporal.Instant.from` reaches this).
 *
 * @example canonicalInstantIntervals([{ start: "2024-01-01T09:00:00.000Z", end: "2024-01-01T12:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }]
 * @example canonicalInstantIntervals([]) // []
 */
export function canonicalInstantIntervals(
  intervals: ReadonlyArray<{ start: string; end: string }>,
): Array<{ start: string; end: string }> | null {
  try {
    return intervals.map(({ start, end }) => ({
      start: Temporal.Instant.from(start).toString(),
      end: Temporal.Instant.from(end).toString(),
    }));
  } catch {
    return null;
  }
}
