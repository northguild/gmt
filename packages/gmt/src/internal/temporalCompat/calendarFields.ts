import type { Temporal } from "../temporal";

/** A date's fields in one calendar. `month` is ordinal (Hebrew leap year: `M05L` is 6). */
export interface CalendarFields {
  year: number;
  month: number;
  monthCode: string;
  day: number;
  era: string | undefined;
  eraYear: number | undefined;
}

/** The fields of `date` in the Temporal calendar `calendarId`: its `withCalendar` read. */
export function calendarFieldsOf(
  date: Temporal.PlainDate,
  calendarId: string,
): CalendarFields {
  const read = date.withCalendar(calendarId);
  return {
    year: read.year,
    month: read.month,
    monthCode: read.monthCode,
    day: read.day,
    era: read.era,
    eraYear: read.eraYear,
  };
}
