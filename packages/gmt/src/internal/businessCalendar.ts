import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../plain/validate/isValidDate";
import type { BusinessCalendar } from "../types";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";

const ISO_WEEKDAYS = 7;

/**
 * The weekend GMT assumed before calendars existed: Saturday and Sunday, no holidays. It is
 * what `isBusinessDay`, `addBusinessDays` and `subtractBusinessDays` use when no calendar is
 * passed, so their shipped behaviour is unchanged.
 */
const DEFAULT_WEEKEND: readonly number[] = [6, 7];

/**
 * Calendar days a single business-day walk may step before giving up — roughly 547 years, far
 * past any real schedule. A walk that runs out returns the sentinel, never a partial answer.
 */
export const MAX_BUSINESS_DAY_STEPS = 200_000;

/** A `BusinessCalendar` reduced to the two lookups every walk needs. */
export type ResolvedBusinessCalendar = {
  weekend: Set<number>;
  holidays: Set<string>;
};

export const DEFAULT_BUSINESS_CALENDAR: ResolvedBusinessCalendar = {
  weekend: new Set(DEFAULT_WEEKEND),
  holidays: new Set<string>(),
};

function parseWeekend(weekend: unknown): Set<number> | null {
  if (!Array.isArray(weekend)) {
    return null;
  }

  const everyDayInRange = weekend.every(
    (day) => Number.isInteger(day) && day >= 1 && day <= ISO_WEEKDAYS,
  );

  if (!everyDayInRange) {
    return null;
  }

  const days = new Set<number>(weekend as number[]);

  // All seven weekdays closed leaves no business day, so every walk would run to its cap.
  return days.size < ISO_WEEKDAYS ? days : null;
}

function parseHolidays(holidays: unknown): Set<string> | null {
  if (!Array.isArray(holidays)) {
    return null;
  }

  const dates = new Set<string>();

  try {
    for (const holiday of holidays) {
      if (typeof holiday !== "string" || !isValidDate(holiday)) {
        return null;
      }

      // Normalise through Temporal so a holiday and a walked date compare as the same string.
      dates.add(Temporal.PlainDate.from(holiday).toString());
    }
  } catch {
    return null;
  }

  return dates;
}

/**
 * Reduce a caller-supplied `BusinessCalendar` to its lookups, or `null` when it is not one.
 *
 * `undefined` is rejected here; `resolveBusinessCalendar` is the entry point that treats an
 * absent calendar as the default Saturday–Sunday week.
 */
export function parseBusinessCalendar(
  calendar: unknown,
): ResolvedBusinessCalendar | null {
  if (
    typeof calendar !== "object" ||
    calendar === null ||
    Array.isArray(calendar)
  ) {
    return null;
  }

  const { weekend, holidays, timeZone } = calendar as Record<string, unknown>;

  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
    return null;
  }

  const weekendDays = parseWeekend(weekend);
  const holidayDates = parseHolidays(holidays);

  if (weekendDays === null || holidayDates === null) {
    return null;
  }

  return { weekend: weekendDays, holidays: holidayDates };
}

/**
 * Resolve an optional calendar: absent means the default Saturday–Sunday week with no
 * holidays, anything else must be a valid `BusinessCalendar` or this returns `null`.
 */
export function resolveBusinessCalendar(
  calendar: BusinessCalendar | undefined,
): ResolvedBusinessCalendar | null {
  return calendar === undefined
    ? DEFAULT_BUSINESS_CALENDAR
    : parseBusinessCalendar(calendar);
}

/** True when `date` is neither a weekend day nor a holiday in `calendar`. */
export function isBusinessDate(
  date: Temporal.PlainDate,
  calendar: ResolvedBusinessCalendar,
): boolean {
  return (
    !calendar.weekend.has(date.dayOfWeek) &&
    !calendar.holidays.has(date.toString())
  );
}

/**
 * The first business day at or beyond `date`, walking in `direction`.
 *
 * Returns `date` itself when it is already a business day, and `null` when the walk exceeds
 * `MAX_BUSINESS_DAY_STEPS`.
 */
export function businessDateFrom(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  let current = date;

  // `step` counts calendar days moved, exactly as it does in `stepBusinessDates`, so both
  // walks give up at the same distance — the 200,000 the public JSDoc quotes.
  for (let step = 0; step < MAX_BUSINESS_DAY_STEPS; step++) {
    if (isBusinessDate(current, calendar)) {
      return current;
    }

    current = current.add({ days: direction });
  }

  return isBusinessDate(current, calendar) ? current : null;
}

/**
 * Step `count` business days from `date` in `direction`, counting only days that are business
 * days in `calendar`.
 *
 * `count` is a non-negative whole number of business days. `date` itself is never counted, so
 * a `count` of 0 returns `date` unchanged even when it is not a business day. Returns `null`
 * when the walk exceeds `MAX_BUSINESS_DAY_STEPS`.
 */
export function stepBusinessDates(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  count: number,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  let current = date;
  let remaining = count;

  for (let step = 0; step < MAX_BUSINESS_DAY_STEPS && remaining > 0; step++) {
    current = current.add({ days: direction });

    if (isBusinessDate(current, calendar)) {
      remaining -= 1;
    }
  }

  return remaining === 0 ? current : null;
}
