/**
 * Plural unit keys accepted by `formatDuration` for `UNIT_TO_INTL` lookup. Maps to
 * singular `Intl.NumberFormat` unit labels (e.g. `"years"` → `"year"`).
 */
export type DurationUnit =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes"
  | "seconds";
