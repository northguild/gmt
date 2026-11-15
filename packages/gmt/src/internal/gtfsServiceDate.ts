/*
 * The GTFS Schedule service date (`20240130`): `YYYYMMDD`. Private: there is no public validator
 * for it, because it is not a new format (a GTFS date is an ISO 8601 calendar date) and the one
 * public function that reads it is `gtfsToInstant`.
 *
 * Source: GTFS Schedule Reference, revised 27 April 2026, published by MobilityData at
 * https://gtfs.org/documentation/schedule/reference/
 * - § Field Types, Date: "Service day in the YYYYMMDD format".
 *
 * GMT rules:
 * - `YYYY-MM-DD` is read too. ISO 8601-1:2019 §5.2.2.1 gives the calendar date in basic
 *   (`YYYYMMDD`) and extended (`YYYY-MM-DD`) form, and GMT's input is ISO 8601.
 * - The shape is checked before Temporal is asked: `Temporal.PlainDate.from` also reads
 *   date-times, extended years, offsets and annotations as a date, and a GTFS date is none of
 *   them. Mixed forms (`2024-0130`), non-ASCII digits and a two-digit year are rejected here.
 * - The calendar (a month's length, leap days) is checked by Temporal, which throws `RangeError`
 *   for a day the month lacks.
 * - Nothing is trimmed; the caller's CSV reader does that.
 */

import { Temporal } from "./temporal";

// No flags: `$` must fail before a trailing newline, and `test` stays stateless.
const GTFS_SERVICE_DATE = /^[0-9]{4}(?:[0-9]{4}|-[0-9]{2}-[0-9]{2})$/;

/**
 * The service date as canonical "YYYY-MM-DD", or null. Never throws.
 *
 * @example gtfsServiceDateOf("20240130") // "2024-01-30"
 * @example gtfsServiceDateOf("2024-01-30") // "2024-01-30"
 * @example gtfsServiceDateOf("20240230") // null
 */
export function gtfsServiceDateOf(value: unknown): string | null {
  if (typeof value !== "string" || !GTFS_SERVICE_DATE.test(value)) return null;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return null;
  }
}
