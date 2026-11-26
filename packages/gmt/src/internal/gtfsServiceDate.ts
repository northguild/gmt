/*
 * The GTFS Schedule service date (`20240130`), read in two forms. Private: there is no public
 * validator for it, because it is no new format and the one public function that reads it is
 * `gtfsToInstant`.
 *
 * The two forms, each with its own source and its own pattern:
 * - `YYYYMMDD` is the form feeds contain. GTFS Schedule Reference, revised 27 April 2026, published
 *   by MobilityData at https://gtfs.org/documentation/schedule/reference/, § Field Types, Date:
 *   "Service day in the YYYYMMDD format".
 * - `YYYY-MM-DD` is GMT's plain-date input form (`regex/date.ts` `plainDate`, the shape
 *   `isValidDate` reads), so a caller can pass a date GMT gave them. GMT rule, not GTFS.
 *
 * GMT rules:
 * - Both forms take a four-digit year, because a GTFS date has one. So the plain-date form here is
 *   `plainDate` without its expanded years: `+002024-01-30` is not a service date.
 * - The shape is checked before Temporal is asked: `Temporal.PlainDate.from` also reads
 *   date-times, extended years, offsets and annotations as a date, and a GTFS date is none of
 *   them. Mixed forms (`2024-0130`), non-ASCII digits and a two-digit year are rejected here.
 * - The calendar (a month's length, leap days) is checked by Temporal, which throws `RangeError`
 *   for a day the month lacks.
 * - Nothing is trimmed; the caller's CSV reader does that.
 */

import { Temporal } from "./temporal";

// No flags on either: `$` must fail before a trailing newline, and `test` stays stateless.
/** GTFS § Field Types, Date. */
const GTFS_DATE = /^[0-9]{8}$/;
/** GMT's plain-date form, with a four-digit year only. */
const PLAIN_DATE_FOUR_DIGIT_YEAR = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/**
 * The service date as canonical "YYYY-MM-DD", or null. Never throws.
 *
 * @example gtfsServiceDateOf("20240130") // "2024-01-30"
 * @example gtfsServiceDateOf("2024-01-30") // "2024-01-30"
 * @example gtfsServiceDateOf("20240230") // null
 * @example gtfsServiceDateOf("+002024-01-30") // null
 */
export function gtfsServiceDateOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!GTFS_DATE.test(value) && !PLAIN_DATE_FOUR_DIGIT_YEAR.test(value))
    return null;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return null;
  }
}
