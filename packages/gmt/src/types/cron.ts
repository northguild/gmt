import type { LocalTimeClassification } from "../instant/convert/classifyLocal";

/**
 * One field of a parsed five-field crontab schedule.
 */
export type CronField = {
  /** The values the field matches, strictly ascending. */
  values: readonly number[];
  /**
   * True when the field was written `*` or `*\/n`, or set by a nickname (as cronie `entry.c`
   * records `*_STAR`; cronie has no month flag, so month follows the nickname's `*`).
   */
  star: boolean;
};

/**
 * A parsed five-field crontab schedule (minute, hour, day of month, month, day of week).
 */
export type CronExpression = {
  /** Minutes, 0 to 59. */
  minute: CronField;
  /** Hours, 0 to 23. */
  hour: CronField;
  /** Days of the month, 1 to 31. */
  dayOfMonth: CronField;
  /** Months, 1 to 12. */
  month: CronField;
  /** `IsoWeekday` values 1 to 7 (Monday 1, Sunday 7); cron's `0` and `7` both read as 7. */
  dayOfWeek: CronField;
};

/**
 * How `cronRuns` treats a scheduled wall time that a zone transition skips or repeats:
 * `"crontabMatch"` matches the schedule against each real wall time; `"daemonCatchUp"` runs a
 * skipped job once after the gap, as a cron daemon does.
 */
export type CronTransitionPolicy = "crontabMatch" | "daemonCatchUp";

/**
 * One run of a cron schedule in a zone.
 */
export type CronRun = {
  /** The wall time the schedule named, `YYYY-MM-DDTHH:mm:ss`. */
  local: string;
  /** The instant the run happens, `…Z`. */
  instant: string;
  /** What `local` is in the zone. */
  classification: LocalTimeClassification;
};
