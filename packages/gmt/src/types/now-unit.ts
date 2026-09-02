/**
 * Units extractable from the current system local time via `getNowUnit`.
 * Defined as `DateTimeUnit | "dayOfWeek"`.
 */
export type NowUnit = import("./date-time-unit").DateTimeUnit | "dayOfWeek";
