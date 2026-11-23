/**
 * The most characters of an `OperatingSchedule`'s JSON text any tool takes: the chat schema
 * (`operatingScheduleTextSchema`), the `schedule` permalink key and the tools' own text areas
 * all hold this one number.
 *
 * It lives apart from `dox-tool-schemas.ts` because `widget-permalink.ts` reads it, and a docs
 * page loads that module without `zod`.
 */
export const SCHEDULE_TEXT_MAX = 8000;
