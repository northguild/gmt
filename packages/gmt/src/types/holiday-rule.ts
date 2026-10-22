import type { BusinessCalendar } from "./business-calendar";
import type { CalendarSystem } from "./calendar-system";
import type { ObservancePolicy } from "./observance-policy";
import type { IsoWeekday } from "./operating-schedule";

/**
 * Which occurrence of a weekday in a month to pick.
 *
 * `1` to `5` count from the start of the month, `-1` to `-5` from the end, as RFC 5545 §3.3.10
 * counts a `BYDAY` ordinal in a monthly rule. `"last"` and `-1` name the same occurrence.
 */
export type WeekdayOrdinal =
  | 1
  | 2
  | 3
  | 4
  | 5
  | -1
  | -2
  | -3
  | -4
  | -5
  | "last";

/**
 * Which Easter computus to apply: "gregorian" (the Gregorian method) or "julian" (the Julian
 * calendar's method, with its date converted to ISO). Either way the result is an ISO date.
 */
export type EasterComputus = "gregorian" | "julian";

/**
 * A holiday written as a rule, not a list of dates. `name` is a label for the caller: it is never
 * read, returned or checked beyond being a string. Properties a kind does not define are ignored.
 *
 * - `"fixed"`: the same ISO month and day every year. A date a year lacks (29 February in a common
 *   year) is skipped, never moved.
 * - `"calendarFixed"`: the same month code and day in another calendar's year (1 Shawwal in
 *   `islamic-umalqura`), computed by the calendar's rules. A date a year lacks is skipped.
 * - `"nthWeekday"`: the `n`-th ISO weekday of an ISO month (third Monday of January).
 * - `"easterRelative"`: Easter Sunday of the year plus `offsetDays`.
 * - `"dates"`: an explicit list of ISO dates, for sightings and one-off closures no rule computes.
 */
export type HolidayRule = {
  /** A label for the caller; never read into a result. Any string, including `""`. */
  name: string;
} & (
  | {
      /** Discriminant: a fixed month and day in the ISO calendar. */
      kind: "fixed";
      /** ISO month, 1 (January) to 12. */
      month: number;
      /** Day of the month, 1 to the month's length (29 for February). */
      day: number;
      /**
       * Where the holiday is observed when it falls on a weekday the policy shifts. A shifted
       * holiday closes only its observed date.
       *
       * @defaultValue undefined (no shift: observed on its own date)
       */
      observed?: ObservancePolicy;
    }
  | {
      /** Discriminant: a month code and day in another calendar. */
      kind: "calendarFixed";
      /**
       * Calendar the month and day belong to. The type lists the canonical ids; at run time the
       * aliases a calendar guard accepts (such as `"islamicc"`) are tolerated too, and not typed
       * so that the public surface names one spelling per calendar.
       */
      calendar: CalendarSystem;
      /** Month code: `"M01"` to `"M12"`, plus `"M13"` (coptic, ethiopic, ethioaa) and `"M05L"` (hebrew). */
      monthCode: string;
      /** Day of the month, 1 to 31; a month that lacks the day skips that year. */
      day: number;
      /**
       * Where the holiday is observed when it falls on a weekday the policy shifts.
       *
       * @defaultValue undefined (no shift: observed on its own date)
       */
      observed?: ObservancePolicy;
    }
  | {
      /** Discriminant: the n-th weekday of an ISO month. */
      kind: "nthWeekday";
      /** ISO month, 1 (January) to 12. */
      month: number;
      /** ISO weekday, 1 (Monday) to 7 (Sunday). */
      weekday: IsoWeekday;
      /** Which occurrence: `1`..`5` from the start, `-1`..`-5` or `"last"` from the end. */
      n: WeekdayOrdinal;
    }
  | {
      /** Discriminant: a fixed number of days from Easter Sunday. */
      kind: "easterRelative";
      /** Whole days after (positive) or before (negative) Easter Sunday. */
      offsetDays: number;
      /**
       * Which Easter to count from.
       *
       * @defaultValue "gregorian"
       */
      computus?: EasterComputus;
    }
  | {
      /** Discriminant: an explicit list of dates. */
      kind: "dates";
      /** ISO PlainDate strings (`"2026-03-20"`); the ones inside the requested year are returned. */
      dates: string[];
    }
);

/**
 * The input of `buildBusinessCalendar`: a weekend, a list of holiday rules and the years to
 * expand them over.
 */
export type BusinessCalendarSpec = {
  /** IANA time zone the calendar describes, as in `BusinessCalendar`. */
  timeZone: string;
  /** ISO weekdays that are closed every week, 1 (Monday) to 7 (Sunday). */
  weekend: number[];
  /** Rules expanded in list order; each shift sees the calendar built so far. */
  rules: HolidayRule[];
  /** Inclusive range of ISO years to expand, at most 400 years. */
  years: {
    /** First ISO year to expand. */
    from: number;
    /** Last ISO year to expand; at most 399 years after `from`. */
    to: number;
  };
};

/** Options of `holidayDates`. */
export type HolidayDatesOptions = {
  /**
   * Open and closed days, needed by a rule whose policy shifts to `"nextWorkingDay"`. It is
   * validated even when the rule never uses it.
   *
   * @defaultValue undefined (no calendar: a `"nextWorkingDay"` policy gives `[]`)
   */
  calendar?: BusinessCalendar;
};
