import type { BusinessCalendar } from "./business-calendar";

/**
 * An ISO weekday number: 1 (Monday) through 7 (Sunday), as `Temporal.PlainDate#dayOfWeek`
 * reads it.
 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * A daily window of local wall time, half-open: open from `from` up to (not including) `to`.
 *
 * - `from` and `to` are wall-clock readings in the schedule's zone, not instants.
 * - A window belongs to the date it starts on. A Friday night window listed under weekday 5
 *   runs into Saturday morning; a holiday or override on Friday removes or replaces it, and one
 *   on Saturday does not.
 */
export type LocalWindow = {
  /**
   * The wall time the window opens, as an ISO PlainTime string (`"09:00"`, `"17:30:00"`) that
   * `isValidTime` accepts.
   */
  from: string;
  /**
   * The wall time the window closes, as an ISO PlainTime string; the window does not include it.
   * A value after `from` keeps the window inside one local date. A value at or before `from`
   * wraps past midnight into the next local date: `{ from: "23:00", to: "06:00" }` is a night,
   * and `{ from: "00:00", to: "00:00" }` is a whole day.
   */
  to: string;
};

/** One local date whose windows differ from the weekly pattern. */
export type OperatingOverride = {
  /** The local date the override applies to, as an ISO PlainDate string in the schedule's zone. */
  date: string;
  /**
   * The windows that date has instead of its weekly ones, holiday or not. `[]` closes the date
   * for the whole day.
   */
  windows: LocalWindow[];
};

/**
 * Weekly opening hours in one zone, with dated exceptions.
 *
 * This is deliberately a weekly pattern with dated exceptions, not an RFC 5545 recurrence rule:
 * there is no monthly or yearly recurrence.
 */
export type OperatingSchedule = {
  /**
   * The time zone the windows are read in, an IANA name or UTC offset: a time zone identifier
   * (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset`
   * returns). A UTC offset such as `"+02:00"` observes no DST.
   */
  timeZone: string;
  /**
   * The windows of each ISO weekday. A missing weekday, or `[]`, is closed all day. Windows of
   * one weekday may overlap or touch; they are merged.
   */
  weekly: Partial<Record<IsoWeekday, LocalWindow[]>>;
  /**
   * The local dates that are closed, as ISO PlainDate strings. A `BusinessCalendar` can be passed
   * directly: its `holidays` are read, and its `weekend` and `timeZone` are not, because `weekly`
   * already says which weekdays open and `timeZone` above is the zone.
   *
   * @defaultValue None. No date is closed as a holiday.
   */
  holidays?: string[] | BusinessCalendar;
  /**
   * The single dates whose windows replace the weekly ones. An override wins over a holiday on the
   * same date, and two overrides for one date make the schedule invalid.
   *
   * @defaultValue None. Every date follows the weekly pattern and the holidays.
   */
  overrides?: OperatingOverride[];
};
