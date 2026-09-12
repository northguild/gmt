import { Temporal } from "@js-temporal/polyfill";
import { isValidIsoDateLike } from "../plain/validate";

/**
 * Read the calendar date `value` names, where `value` is a zoneless ISO date or datetime.
 *
 * The `calendar/` identifier functions share this gate. An offset, a bracketed zone or a `Z`
 * makes `value` a moment rather than a calendar date, and which date a moment falls on is a
 * zone decision the caller has to make and state — so those are rejected here rather than
 * silently answered in whatever zone the string happened to be written in.
 *
 * - Returns null on anything `isValidIsoDateLike` rejects, and on a Temporal throw.
 */
export function zonelessCalendarDate(value: string): Temporal.PlainDate | null {
  if (!isValidIsoDateLike(value)) return null;

  try {
    return Temporal.PlainDate.from(value);
  } catch {
    return null;
  }
}
