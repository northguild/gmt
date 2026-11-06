import type { SmallestUnit } from "../internal/temporalTypes";

/**
 * Units extractable from the current UTC instant via `getUtcNowUnit`.
 * Defined as `DateTimeUnit | "dayOfWeek"`.
 */
export type UtcNowUnit =
  | SmallestUnit<import("./date-time-unit").DateTimeUnit>
  | "dayOfWeek";
