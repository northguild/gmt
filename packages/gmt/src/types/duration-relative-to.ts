import type { Temporal } from "@js-temporal/polyfill";

/**
 * The anchor a calendar-unit duration operation is measured from, as Temporal's `relativeTo`
 * option takes it (`Duration.prototype.round`, `Duration.prototype.total`, `Duration.compare`).
 *
 * Years, months and weeks have no fixed length, so any operation touching them needs a starting
 * point; an operation on days and time units alone does not. A string is an ISO 8601 date or
 * date-time, or a zoned date-time with its time zone annotation.
 */
export type DurationRelativeTo =
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime
  | Temporal.PlainDateTimeLike
  | Temporal.ZonedDateTimeLike
  | string;
