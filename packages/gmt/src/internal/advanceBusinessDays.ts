import type { Temporal } from "@js-temporal/polyfill";
import {
  DEFAULT_BUSINESS_CALENDAR,
  type ResolvedBusinessCalendar,
  stepBusinessDates,
} from "./businessCalendar";

/**
 * Advance `target` business days from `start` in `direction`, skipping `calendar`'s weekend
 * days and holidays.
 *
 * - `calendar` defaults to Saturday–Sunday with no holidays.
 * - Returns `null` when the walk runs past `MAX_BUSINESS_DAY_STEPS` — a bounded loop that runs
 *   out returns the sentinel, never a partial value.
 */
export function advanceBusinessDays(
  start: Temporal.PlainDate,
  direction: 1 | -1,
  target: number,
  calendar: ResolvedBusinessCalendar = DEFAULT_BUSINESS_CALENDAR,
): Temporal.PlainDate | null {
  return stepBusinessDates(start, direction, target, calendar);
}
