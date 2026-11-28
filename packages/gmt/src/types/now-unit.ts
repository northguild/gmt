import type { SmallestUnit } from "../internal/temporalTypes";

/**
 * Units extractable from the current system local time via `getNowUnit`.
 * Defined as `DateTimeUnit | "dayOfWeek"`.
 */
export type NowUnit =
  | SmallestUnit<import("./date-time-unit").DateTimeUnit>
  | "dayOfWeek";
