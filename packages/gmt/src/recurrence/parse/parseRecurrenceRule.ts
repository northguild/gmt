import { readRecurrenceRule } from "../../internal/recurrenceRuleText";
import type { RecurrenceRule } from "../../types";

/**
 * Parse an RFC 5545 §3.3.10 RECUR value (`FREQ=MONTHLY;BYDAY=-1FR`) into a {@link RecurrenceRule}.
 *
 * - `value` is the RECUR value alone: the text after `RRULE:`. A `RRULE:` prefix returns `null`.
 * - Parts are separated by `;`, list items by `,`, with no whitespace and no empty part or item.
 *   Part names, `FREQ` values and weekdays are case-insensitive. Parts may come in any order,
 *   but each at most once.
 * - All 14 parts are read. `EXRULE`, `RSCALE`, `SKIP` and `X-` names return `null`.
 * - Lists are sets: the result holds them deduplicated and ascending. `byDay` is ordered by weekday
 *   (1 = Monday), then by ordinal, with an absent ordinal first.
 * - `interval` defaults to 1 and `firstDayOfWeek` to 1 (`WKST=MO`). An absent part is an absent key.
 * - `UNTIL` is rebuilt, not kept as written, in Temporal's ISO form: `"1997-12-24T00:00:00Z"` for a
 *   UTC date-time, `"1997-12-24T00:00:00"` for a floating one, `"1997-12-24"` for a date. Its `T`
 *   and `Z` must be capitals (RFC 5545 §3.3.5). A second of 60 returns `null`, UTC or floating:
 *   GMT reads second 60 only in `timescale/` and `gnss/`.
 * - `COUNT=0` returns `null` by a GMT rule: the RFC grammar (`1*DIGIT`) would allow it.
 * - Returns `null` for anything §3.3.10 does not allow: a missing `FREQ`, `COUNT` together with
 *   `UNTIL`, a value out of its range, a numeric `BYDAY` outside `MONTHLY` and `YEARLY`,
 *   `BYMONTHDAY` with `WEEKLY`, `BYYEARDAY` with `DAILY`, `WEEKLY` or `MONTHLY`, `BYWEEKNO` outside
 *   `YEARLY`, `BYSETPOS` with no other `BY` part, and an `UNTIL` that is not a real date.
 *
 * @param value RECUR value, e.g. `"FREQ=WEEKLY;BYDAY=MO,WE"`
 * @returns the parsed rule, or `null` on invalid input
 *
 * @example parseRecurrenceRule("FREQ=MONTHLY;BYDAY=-1FR") // { frequency: "monthly", interval: 1, firstDayOfWeek: 1, byDay: [{ day: 5, nthOfPeriod: -1 }] }
 * @example parseRecurrenceRule("count=10;freq=daily") // { frequency: "daily", interval: 1, firstDayOfWeek: 1, count: 10 }
 * @example parseRecurrenceRule("FREQ=WEEKLY;UNTIL=19971224T000000Z;WKST=SU;BYDAY=TU,TH") // { frequency: "weekly", interval: 1, firstDayOfWeek: 7, until: "1997-12-24T00:00:00Z", byDay: [{ day: 2 }, { day: 4 }] }
 * @example parseRecurrenceRule("FREQ=DAILY;COUNT=5;UNTIL=20240101") // null (COUNT and UNTIL together)
 * @example parseRecurrenceRule("RRULE:FREQ=DAILY") // null (value only, no prefix)
 * @example parseRecurrenceRule("FREQ=DAILY;UNTIL=19970630T235960Z") // null (second 60)
 */
export function parseRecurrenceRule(value: string): RecurrenceRule | null {
  try {
    return readRecurrenceRule(value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
