import type { Temporal } from "@js-temporal/polyfill";

// The anchor date a calendar-unit duration operation resolves against, as accepted by
// Temporal's `relativeTo` option (Duration.prototype.round/.total, Duration.compare).
// Years/months/weeks have no fixed length, so any operation touching them needs a
// starting point; day/time-only operations do not.
export type DurationRelativeTo =
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime
  | Temporal.PlainDateTimeLike
  | Temporal.ZonedDateTimeLike
  | string;
