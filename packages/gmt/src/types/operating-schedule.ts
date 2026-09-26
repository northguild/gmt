import type { BusinessCalendar } from "./business-calendar";

/**
 * An ISO weekday number: 1 (Monday) through 7 (Sunday), as `Temporal.PlainDate#dayOfWeek`
 * reads it.
 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * A daily window of local wall time, half-open: open from `from` up to (not including) `to`.
 *
 * - `from` and `to` are ISO PlainTime strings (`"09:00"`, `"17:30:00"`), as `isValidTime`
 *   accepts them. They are wall-clock readings in the schedule's zone, not instants.
 * - `to` after `from` is a window inside one local date. `to` at or before `from` wraps past
 *   midnight into the next local date: `{ from: "23:00", to: "06:00" }` is a night, and
 *   `{ from: "00:00", to: "00:00" }` is a whole day.
 * - A window belongs to the date it starts on. A Friday night window listed under weekday 5
 *   runs into Saturday morning; a holiday or override on Friday removes or replaces it, and one
 *   on Saturday does not.
 */
export type LocalWindow = { from: string; to: string };

/**
 * One local date whose windows differ from the weekly pattern.
 *
 * - `date` is an ISO PlainDate string in the schedule's zone.
 * - `windows` replaces that date's weekly windows entirely, holiday or not. `[]` closes the
 *   date for the whole day.
 */
export type OperatingOverride = { date: string; windows: LocalWindow[] };

/**
 * Weekly opening hours in one zone, with dated exceptions.
 *
 * - `timeZone` is the IANA identifier the windows are read in. A fixed offset such as
 *   `"+02:00"` is accepted, as `isValidTimeZone` accepts it, but observes no DST.
 * - `weekly` maps an ISO weekday to that day's windows. A missing weekday, or `[]`, is closed all
 *   day. Windows of one weekday may overlap or touch; they are merged.
 * - `holidays` is the local dates that are closed, as ISO PlainDate strings. A `BusinessCalendar`
 *   can be passed here directly: its `holidays` are read, and its `weekend` and `timeZone` are
 *   not, because `weekly` already says which weekdays open and `timeZone` above is the zone.
 * - `overrides` replaces the windows of single dates. An override wins over a holiday on the
 *   same date. Two overrides for one date make the schedule invalid.
 *
 * This is deliberately a weekly pattern with dated exceptions, not an RFC 5545 recurrence rule:
 * there is no monthly or yearly recurrence.
 */
export type OperatingSchedule = {
  timeZone: string;
  weekly: Partial<Record<IsoWeekday, LocalWindow[]>>;
  holidays?: string[] | BusinessCalendar;
  overrides?: OperatingOverride[];
};
