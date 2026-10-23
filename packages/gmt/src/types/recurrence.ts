import type { LocalTimeClassification } from "../instant/convert/classifyLocal";
import type { Disambiguation } from "./disambiguation";
import type { Interval } from "./interval";
import type { IsoWeekday } from "./operating-schedule";

/**
 * How often an RFC 5545 §3.3.10 rule repeats (`FREQ`).
 */
export type RecurrenceFrequency =
  | "yearly"
  | "monthly"
  | "weekly"
  | "daily"
  | "hourly"
  | "minutely"
  | "secondly";

/**
 * One `BYDAY` entry: a weekday, optionally the nth such weekday of the period.
 */
export type RecurrenceDay = {
  /** The weekday, 1 (Monday) to 7 (Sunday). */
  day: IsoWeekday;
  /**
   * A signed ordinal, 1 to 53 or -53 to -1. Absent for "every". Valid only with `monthly` or
   * `yearly`, and not with `yearly` plus `byWeekNo`.
   * @defaultValue None. Every such weekday of the period.
   */
  nthOfPeriod?: number;
};

/**
 * A parsed RFC 5545 §3.3.10 recurrence rule. Member names follow the RFC 8984 §4.3.3 object.
 */
export type RecurrenceRule = {
  /** `FREQ`. */
  frequency: RecurrenceFrequency;
  /** `INTERVAL`, a positive integer. */
  interval: number;
  /** `WKST` as an `IsoWeekday`. */
  firstDayOfWeek: IsoWeekday;
  /**
   * `UNTIL`, rebuilt from the RFC text in Temporal's ISO form, one of three: a UTC date-time
   * (`"1997-12-24T00:00:00Z"`), a floating date-time (`"1997-12-24T00:00:00"`) or a date
   * (`"1997-12-24"`). `expandRecurrence` accepts only the first form, per RFC 5545 §3.3.10.
   * @defaultValue None. The rule has no end date unless `count` ends it.
   */
  until?: string;
  /**
   * `COUNT`, the number of occurrences.
   * @defaultValue None. The rule has no count limit unless `until` ends it.
   */
  count?: number;
  /**
   * `BYSECOND`, 0 to 60.
   * @defaultValue None. The seconds come from DTSTART.
   */
  bySecond?: readonly number[];
  /**
   * `BYMINUTE`, 0 to 59.
   * @defaultValue None. The minutes come from DTSTART.
   */
  byMinute?: readonly number[];
  /**
   * `BYHOUR`, 0 to 23.
   * @defaultValue None. The hours come from DTSTART.
   */
  byHour?: readonly number[];
  /**
   * `BYDAY`.
   * @defaultValue None. The weekdays come from the frequency and DTSTART.
   */
  byDay?: readonly RecurrenceDay[];
  /**
   * `BYMONTHDAY`, 1 to 31 or -31 to -1.
   * @defaultValue None. The days of the month come from DTSTART.
   */
  byMonthDay?: readonly number[];
  /**
   * `BYYEARDAY`, 1 to 366 or -366 to -1.
   * @defaultValue None. No year-day filter.
   */
  byYearDay?: readonly number[];
  /**
   * `BYWEEKNO`, 1 to 53 or -53 to -1.
   * @defaultValue None. No week-number filter.
   */
  byWeekNo?: readonly number[];
  /**
   * `BYMONTH`, 1 to 12.
   * @defaultValue None. The months come from DTSTART.
   */
  byMonth?: readonly number[];
  /**
   * `BYSETPOS`, 1 to 366 or -366 to -1.
   * @defaultValue None. Every candidate in a period is kept.
   */
  bySetPosition?: readonly number[];
};

/**
 * Which occurrences to expand: every one inside an interval, or the first `count` after an instant.
 */
export type OccurrenceWindow = Interval | { after: string; count: number };

/**
 * Options for `expandRecurrence`.
 */
export type ExpandRecurrenceOptions = {
  /**
   * Extra occurrences (`RDATE`), as ISO date-times.
   * @defaultValue None. No extra occurrences.
   */
  rdate?: readonly string[];
  /**
   * Occurrences to remove (`EXDATE`), as ISO date-times.
   * @defaultValue None. No occurrences are removed.
   */
  exdate?: readonly string[];
  /**
   * Which instant a wall time in a gap or overlap takes.
   * @defaultValue `"compatible"`, Temporal's default.
   */
  disambiguation?: Disambiguation;
};

/**
 * One occurrence of a rule in a zone.
 */
export type RecurrenceOccurrence = {
  /** The wall time the rule named, `YYYY-MM-DDTHH:mm:ss`. */
  local: string;
  /** The instant chosen, `…Z`. */
  instant: string;
  /** What `local` is in the zone. It always equals `classifyLocal(local, timeZone)`. */
  classification: LocalTimeClassification;
  /** The instant `"earlier"` gives. Equals `instant` when `local` is unique. */
  earlier: string;
  /** The instant `"later"` gives. Equals `instant` when `local` is unique. */
  later: string;
};
