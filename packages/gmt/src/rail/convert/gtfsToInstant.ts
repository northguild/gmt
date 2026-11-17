import { gtfsServiceDateOf } from "../../internal/gtfsServiceDate";
import { readGtfsTime } from "../../internal/gtfsTime";
import { resolveLocalInstant } from "../../internal/resolveLocalInstant";
import { Temporal } from "../../internal/temporal";

/** Seconds in a GTFS day: the unit `dayOverflow` counts. */
const SECONDS_PER_DAY = 86_400;
/** GTFS measures a time from "noon minus 12h" of the service day. */
const ANCHOR_HOURS_BEFORE_NOON = 12;

/**
 * The UTC instant a GTFS time names on its service day in the agency's time zone.
 *
 * - A GTFS time is measured from "noon minus 12 hours" of the service day. That is midnight
 *   except on a day the clocks change, so `00:00:00` on a spring-forward day is 23:00 the day
 *   before, and the result can fall on another local date. The reference gives no reason for noon;
 *   it works because clocks change at night, so noon occurs once. Anchoring on local midnight
 *   would bring back the bug the definition avoids.
 * - A time past `24:00:00` is elapsed time from that anchor, not a wall-clock move. A later
 *   clock change therefore shifts its local reading: `26:30:00` on 2024-03-09 in New York is
 *   03:30 EDT, and `25:30:00` and `26:30:00` on 2024-11-02 both read 01:30, an hour apart.
 * - `serviceDate` is a GTFS `Date` (`YYYYMMDD`). GMT's plain-date form `YYYY-MM-DD` is read too,
 *   with a four-digit year only, as a GTFS date has.
 * - `timeZone` is `agency.agency_timezone`, even for a stop that has its own `stop_timezone`.
 *   An IANA name is expected; a numeric offset is read as well.
 * - A result outside years 0000 to 9999 is written with Temporal's expanded year
 *   (`+010000-02-10T15:59:59Z`), not returned as `""`.
 * - Nothing is trimmed: a space, tab, newline or byte order mark returns `""`.
 * - Returns `""` on invalid input.
 *
 * Disambiguation: the one local time this resolves is noon on the service date, with
 * `"reject"`: a noon the zone skipped (nonexistent) or repeated (ambiguous) returns `""`. The
 * GTFS time itself is never resolved as a wall time; it is exact seconds after the anchor, so it
 * is never ambiguous or nonexistent.
 *
 * Source: GTFS Schedule Reference § Field Types, Time and Date; § stop_times.txt arrival_time.
 *
 * @param serviceDate A GTFS service day, such as a `calendar_dates.txt` `date`: `YYYYMMDD` or
 *   `YYYY-MM-DD`
 * @param gtfsTime A GTFS `Time`, such as `stop_times.txt` `arrival_time`, as `parseGtfsTime`
 *   reads it: `H:MM:SS` to `999:59:59`
 * @param timeZone The feed's `agency.agency_timezone`
 * @returns The UTC instant ending in `"Z"`, or `""` on invalid input
 *
 * @example gtfsToInstant("20240130", "25:35:00", "America/Los_Angeles") // "2024-01-31T09:35:00Z"
 * @example gtfsToInstant("2024-01-30", "25:35:00", "America/Los_Angeles") // "2024-01-31T09:35:00Z"
 * @example gtfsToInstant("20240331", "00:00:00", "Europe/Berlin") // "2024-03-30T22:00:00Z" (23:00 local)
 * @example gtfsToInstant("20240407", "00:00:00", "Australia/Sydney") // "2024-04-06T14:00:00Z"
 * @example gtfsToInstant("20240309", "26:30:00", "America/New_York") // "2024-03-10T07:30:00Z" (03:30 EDT)
 * @example gtfsToInstant("20241102", "26:30:00", "America/New_York") // "2024-11-03T06:30:00Z" (second 01:30)
 * @example gtfsToInstant("99991231", "999:59:59", "UTC") // "+010000-02-10T15:59:59Z"
 * @example gtfsToInstant("20240230", "25:35:00", "America/Los_Angeles") // ""
 * @example gtfsToInstant("20240130", "25:35:00", "+05:30") // "2024-01-30T20:05:00Z" (an offset is read)
 * @example gtfsToInstant("20000115", "00:00:00", "Africa/Khartoum") // "" (noon nonexistent)
 */
export function gtfsToInstant(
  serviceDate: string,
  gtfsTime: string,
  timeZone: string,
): string {
  try {
    const date = gtfsServiceDateOf(serviceDate);
    const time = readGtfsTime(gtfsTime);
    if (date === null || time === null) return "";

    const noon = resolveLocalInstant(`${date}T12:00:00`, timeZone, "reject");
    if (noon === "") return "";

    return Temporal.Instant.from(noon)
      .subtract({ hours: ANCHOR_HOURS_BEFORE_NOON })
      .add({ seconds: time.dayOverflow * SECONDS_PER_DAY + time.seconds })
      .toString();
  } catch {
    return "";
  }
}
