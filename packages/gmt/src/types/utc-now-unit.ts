/**
 * Units extractable from the current UTC instant via `getUtcNowUnit`.
 * Defined as `DateTimeUnit | "dayOfWeek"`.
 */
export type UtcNowUnit = import("./date-time-unit").DateTimeUnit | "dayOfWeek";
