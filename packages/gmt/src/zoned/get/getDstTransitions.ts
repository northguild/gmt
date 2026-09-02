import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

const MAX_TRANSITIONS_PER_YEAR = 20;

/**
 * A single DST transition instant: the UTC instant of an offset change plus the
 * offset in effect immediately before and after it.
 *
 * @remarks Members:
 *
 * | Member | Type | Description |
 * | --- | --- | --- |
 * | `instant` | `string` | UTC instant of the offset change, ISO 8601 ending in `Z` (e.g. `2024-03-10T07:00:00Z`). |
 * | `offsetBefore` | `string` | UTC offset in effect immediately before the transition (e.g. `-05:00`). |
 * | `offsetAfter` | `string` | UTC offset in effect immediately after the transition (e.g. `-04:00`). |
 *
 * @example
 * import { DstTransition } from "@northguild/gmt/zoned";
 * const t: DstTransition = {
 *   instant: "2024-03-10T07:00:00Z",
 *   offsetBefore: "-05:00",
 *   offsetAfter: "-04:00",
 * };
 */
export interface DstTransition {
  instant: string;
  offsetBefore: string;
  offsetAfter: string;
}

/**
 * List every DST transition instant for an IANA timezone within a given year.
 *
 * - A "transition" is any UTC offset change: a spring-forward gap (nonexistent
 *   local time) or a fall-back overlap (ambiguous local time) — see
 *   `docs/dst-disambiguation.md` for the gap/overlap terminology. This is
 *   distinct from `hasDaylightSaving` (whether a zone observes DST at all)
 *   and from the `disambiguation`/`offset` options (what to do when
 *   constructing a single instant that lands in a gap/overlap).
 * - Most zones have 0 or 2 transitions per year; some (e.g. `Africa/Casablanca`,
 *   which pauses DST for Ramadan) can have more.
 * - Returns `[]` for an invalid timeZone, a non-integer year, or a valid zone
 *   with zero transitions in that year (not an error case).
 *
 * @param timeZone IANA timeZone identifier
 * @param year calendar year to scan (must be an integer)
 * @returns array of `{ instant, offsetBefore, offsetAfter }`, in chronological order
 *
 * @example getDstTransitions("America/New_York", 2024)
 * // [
 * //   { instant: "2024-03-10T07:00:00Z", offsetBefore: "-05:00", offsetAfter: "-04:00" },
 * //   { instant: "2024-11-03T06:00:00Z", offsetBefore: "-04:00", offsetAfter: "-05:00" },
 * // ]
 * @example getDstTransitions("Asia/Tokyo", 2024) // []
 * @example getDstTransitions("Invalid/Zone", 2024) // []
 */
export function getDstTransitions(
  timeZone: string,
  year: number,
): DstTransition[] {
  if (!isValidTimeZone(timeZone) || !Number.isInteger(year)) {
    return [];
  }

  try {
    let cur = Temporal.ZonedDateTime.from({
      year,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone,
    });

    const transitions: DstTransition[] = [];

    for (let i = 0; i < MAX_TRANSITIONS_PER_YEAR; i++) {
      const next = cur.getTimeZoneTransition("next");
      if (!next || next.year > year) {
        break;
      }

      transitions.push({
        instant: next.toInstant().toString(),
        offsetBefore: cur.offset,
        offsetAfter: next.offset,
      });

      cur = next;
    }

    return transitions;
  } catch {
    return [];
  }
}
