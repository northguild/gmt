/**
 * Units extractable from the current Unix timestamp in UTC via `getUnixNowUnit`.
 * Defined as `DateTimeUnit | "dayOfWeek"`.
 */
export type UnixNowUnit = import("./date-time-unit").DateTimeUnit | "dayOfWeek";
