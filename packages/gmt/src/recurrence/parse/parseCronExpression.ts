import { readCronExpression } from "../../internal/cronText";
import type { CronExpression } from "../../types";

/**
 * Read the time-and-date fields of a crontab line, or one nickname, into a `CronExpression`.
 *
 * - `value` is five fields separated by blanks (spaces or tabs), with no command: minute (0–59),
 *   hour (0–23), day of month (1–31), month (1–12 or `jan`…`dec`) and day of week (0–7 or
 *   `sun`…`sat`). Leading blanks, trailing blanks and newlines are refused.
 * - A value or step is any run of digits. A value is range-checked (`000` is 0); a step only has
 *   to be at least 1 (`*\/100` in minutes gives 0).
 * - A field is `*`, `*\/step`, or a comma list of values and ranges (`a-b`, `a-b/step`). A step
 *   larger than the range is allowed, and it stays inside the field: `*\/23` in hours is 0 and 23.
 * - `*` is read only as a whole field. `1,*\/5` is refused, where cronie and Debian disagree on it.
 * - Day of week is stored as an `IsoWeekday` 1–7 with Sunday as 7: cron's `0` and `7` both
 *   become 7, and a range ending in `0` or `sun` runs to Sunday, so `fri-sun` is 5, 6 and 7.
 * - `star` is true on a field written `*` or `*\/step`. `cronRuns` reads it to decide whether the
 *   two day fields combine with "or" (cronie crontab(5), NOTES).
 * - Nicknames are `@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily`, `@midnight` and
 *   `@hourly`, in lower case.
 * - Returns `null` for anything else: a sixth field, `@reboot`, `L`, `W`, `#`, `?`, `H`, `~`,
 *   `CRON_TZ=`, a step of 0, a descending range, or a value outside its field.
 *
 * @param value the five schedule fields of a crontab line, or one nickname
 * @returns the parsed expression, or `null` on invalid input
 *
 * @example parseCronExpression("0 9-17 * * mon-fri")?.dayOfWeek // { values: [1, 2, 3, 4, 5], star: false }
 * @example parseCronExpression("@daily")?.minute // { values: [0], star: false }
 * @example parseCronExpression("0 0 30 2 *")?.dayOfMonth // { values: [30], star: false }
 * @example parseCronExpression("0 0 * * * *") // null (a sixth field)
 */
export function parseCronExpression(value: string): CronExpression | null {
  if (typeof value !== "string") return null;
  try {
    return readCronExpression(value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
