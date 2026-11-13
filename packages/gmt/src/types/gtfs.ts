/**
 * A GTFS Schedule `Time` value split into the time of day and the whole days past the service day.
 *
 * - `25:35:00` is `{ seconds: 5700, dayOverflow: 1 }`: 1:35 on the day after the service day,
 *   still part of that service day.
 * - `dayOverflow × 86400 + seconds` is the elapsed seconds from noon minus 12 h of the service
 *   day, which GTFS measures every time from. It equals a clock reading only on a day with no
 *   clock change; turning it into an instant needs the service date and the agency's zone.
 */
export interface GtfsTime {
  /** The time of day as written, with the hour taken modulo 24: an integer from 0 to 86399. */
  seconds: number;
  /** The whole days past the service day: 0 up to `23:59:59`, 1 from `24:00:00`, and so on. */
  dayOverflow: number;
}
