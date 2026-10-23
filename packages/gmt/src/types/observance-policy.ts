import type { IsoWeekday } from "./operating-schedule";

/**
 * Where a holiday that falls on one weekday is observed instead.
 *
 * - `"nextWorkingDay"`: the first business day strictly after the holiday. It needs the
 *   `BusinessCalendar` that says which days are open.
 */
export type ObservanceShift =
  | "nextWorkingDay"
  | {
      /** The first weekday strictly after the holiday, 1 to 6 days later; must differ from the holiday's weekday. */
      next: IsoWeekday;
    }
  | {
      /** The first weekday strictly before the holiday, 1 to 6 days earlier; must differ from the holiday's weekday. */
      previous: IsoWeekday;
    };

/**
 * Per ISO weekday of the holiday (1 Monday to 7 Sunday), the shift to apply. A weekday with no
 * entry is not shifted, and `{}` shifts nothing. There is no default policy.
 */
export type ObservancePolicy = Partial<Record<IsoWeekday, ObservanceShift>>;
