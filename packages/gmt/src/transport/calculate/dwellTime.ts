import { Temporal } from "@js-temporal/polyfill";
import { countZonedLocalDates, zonedDateTimeFrom } from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";
import { isValidZonedDateTime } from "../../zoned/validate/isValidZonedDateTime";

/** What `dwellTime` returns: exact elapsed time plus the local view every charging regime counts in. */
export interface Dwell {
  /** Exact elapsed time from entry to exit, as an ISO 8601 duration with hours as the largest unit. */
  duration: string;
  /** The entry, rendered in the dwell zone. */
  enter: string;
  /** The exit, rendered in the dwell zone. */
  exit: string;
  /** Distinct local calendar dates the dwell touched, counted half-open at the exit. */
  calendarDays: number;
}

/**
 * The zone a dwell is counted in: the caller's, or the one the entry string carries.
 *
 * An entry written with a bracketed IANA zone names a place; `Z` and offset-only strings name a
 * moment and nothing else, so with no `targetZone` there is no locality to count days in.
 */
function dwellZone(
  entry: string,
  targetZone: string | undefined,
): string | null {
  if (targetZone !== undefined) {
    return isValidTimeZone(targetZone) ? targetZone : null;
  }
  if (!isValidZonedDateTime(entry)) {
    return null;
  }
  try {
    return zonedDateTimeFrom(entry).timeZoneId;
  } catch {
    return null;
  }
}

/**
 * Measure how long something sat somewhere, and how many local calendar days it sat there.
 *
 * Terminals, depots, yards, stations, gates and berths all charge dwell, and none of them
 * charge by elapsed hours. They count the local calendar days the thing was present, so a
 * container that gates in at 23:00 and out at 01:00 has been there two hours and two days.
 * `dwellTime` returns both, and is the one "local days crossed" primitive in the library: free
 * time and demurrage (INT-12), laytime day counts (MAR-19) and hospital length of stay
 * (HLTH-69) all take their day boundary from here rather than each deciding what a midnight is.
 *
 * - **`duration` is exact elapsed time.** A dwell spanning a DST transition reports the hours
 *   that actually elapsed; the local wall clocks at either end can be an hour apart from that.
 *   Hours is the largest unit, so the value never depends on a calendar.
 * - **`calendarDays` is not `duration` rounded up.** It is the number of distinct local dates
 *   in `targetZone` that the half-open interval `[entry, exit)` touches: entry and exit on the
 *   same local date is `1`, across one local midnight is `2`, and so on. A dwell that ends
 *   exactly at a local midnight does not touch the new day, because the exit instant itself
 *   is excluded — the same half-open rule as `bucketRange` and CORE-6's intervals. A zero-length
 *   dwell touches one date. The count walks the zone's real transitions: between two of them
 *   the wall clock runs forward without a break, so each stretch touches every date from its
 *   first instant to its last, and the count is the size of the union of those dates. A 23- or
 *   25-hour local day is one day, not 0.96 or 1.04 of one; a date the zone deleted is never
 *   touched (`Pacific/Apia` skipped 2011-12-30); and a date the clock falls back into is still
 *   one date (`America/Goose_Bay` fell back from 00:01 on 7 November 2010 into the 6th).
 * - **The zone decides the count, so it has to be stated.** `targetZone` is used when given.
 *   Without it, the entry's bracketed IANA zone is used. As in `Temporal.Instant.from`, a
 *   bracketed zone is otherwise not read, so it is not validated either: the entry's is read
 *   (and must exist and agree with its offset) only when it supplies the dwell zone, because
 *   `targetZone` is omitted, and the exit's is never read. If the entry and exit are bare
 *   instants — `Z` or an offset — and no `targetZone` is given, the result is `null`: an
 *   offset is not a zone (CORE-4), and a day count in an unstated locality would be a guess.
 * - `enter` and `exit` are the two instants rendered in the dwell zone, so a charging record
 *   shows the local times the terminal's own clock showed.
 * - `targetZone` is whatever `isValidTimeZone` accepts, which is what Temporal accepts: an IANA
 *   identifier, or a fixed offset such as `"+02:00"`, as `etaAtZone` also takes. Days are then
 *   counted in that offset, which observes no DST, so pass the place's IANA zone when there is one.
 * - GMT does not resolve a port, terminal or station code to a zone; the caller supplies the
 *   identifier.
 * - Long dwells stay cheap: the walk visits zone transitions, not days. A dwell that crosses
 *   more than 10,000 transitions (about 5,000 years of twice-yearly DST) returns `null`.
 * - Returns `null` when either instant is invalid, when `exit` is before `entry` (an inverted
 *   dwell is a data error, not a negative stay), or when no zone can be determined.
 *
 * @param entry ISO 8601 zoned datetime or instant string of the gate-in, arrival or admission
 * @param exit ISO 8601 zoned datetime or instant string of the gate-out, departure or discharge
 * @param targetZone IANA timeZone identifier or fixed offset the days are counted in; defaults to `entry`'s bracketed zone
 * @returns exact duration, zone-local entry and exit, and the local calendar days touched, or null on invalid input
 *
 * @example dwellTime("2024-06-15T23:00:00-04:00[America/New_York]", "2024-06-16T01:00:00-04:00[America/New_York]") // { duration: "PT2H", enter: "2024-06-15T23:00:00-04:00[America/New_York]", exit: "2024-06-16T01:00:00-04:00[America/New_York]", calendarDays: 2 }
 * @example dwellTime("2024-06-15T08:00:00Z", "2024-06-15T17:30:00Z", "Europe/Berlin") // { duration: "PT9H30M", enter: "2024-06-15T10:00:00+02:00[Europe/Berlin]", exit: "2024-06-15T19:30:00+02:00[Europe/Berlin]", calendarDays: 1 }
 * @example dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/London") // { duration: "PT2H30M", enter: "2024-06-15T23:30:00+01:00[Europe/London]", exit: "2024-06-16T02:00:00+01:00[Europe/London]", calendarDays: 2 }
 * @example dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Amsterdam") // { duration: "PT2H30M", enter: "2024-06-16T00:30:00+02:00[Europe/Amsterdam]", exit: "2024-06-16T03:00:00+02:00[Europe/Amsterdam]", calendarDays: 1 } (the same two instants, one fewer day: the zone decides)
 * @example dwellTime("2024-06-15T22:00:00Z", "2024-06-16T04:00:00Z", "America/New_York") // { duration: "PT6H", enter: "2024-06-15T18:00:00-04:00[America/New_York]", exit: "2024-06-16T00:00:00-04:00[America/New_York]", calendarDays: 1 } (an exit exactly at local midnight does not touch the new day)
 * @example dwellTime("2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "America/New_York") // { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]", exit: "2024-03-10T08:00:00-04:00[America/New_York]", calendarDays: 1 } (seven elapsed hours across the spring-forward, one local day)
 * @example dwellTime("2011-12-30T08:00:00Z", "2011-12-30T11:00:00Z", "Pacific/Apia") // { duration: "PT3H", enter: "2011-12-29T22:00:00-10:00[Pacific/Apia]", exit: "2011-12-31T01:00:00+14:00[Pacific/Apia]", calendarDays: 2 } (29 and 31 December: Samoa deleted the 30th)
 * @example dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "+02:00") // { duration: "PT2H30M", enter: "2024-06-16T00:30:00+02:00[+02:00]", exit: "2024-06-16T03:00:00+02:00[+02:00]", calendarDays: 1 } (a fixed offset counts days with no DST)
 * @example dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z") // null (bare instants and no zone: the day count has no locality)
 * @example dwellTime("2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London") // null (exit before entry)
 * @example dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Londres") // null
 */
export function dwellTime(
  entry: string,
  exit: string,
  targetZone?: string,
): Dwell | null {
  if (!isValidInstant(entry) || !isValidInstant(exit)) {
    return null;
  }

  const zone = dwellZone(entry, targetZone);
  if (zone === null) {
    return null;
  }

  try {
    const entryInstant = Temporal.Instant.from(entry);
    const exitInstant = Temporal.Instant.from(exit);
    if (Temporal.Instant.compare(entryInstant, exitInstant) > 0) {
      return null;
    }

    const enter = entryInstant.toZonedDateTimeISO(zone);
    const leave = exitInstant.toZonedDateTimeISO(zone);

    // Half-open at the exit: the dwell's last instant is one nanosecond before it, so an exit
    // exactly on a local day boundary does not touch the new day. A zero-length dwell still
    // touches the one date it sits on.
    const last =
      Temporal.Instant.compare(entryInstant, exitInstant) < 0
        ? leave.subtract({ nanoseconds: 1 })
        : leave;
    const calendarDays = countZonedLocalDates(enter, last);
    if (calendarDays === null) {
      return null;
    }

    return {
      duration: entryInstant
        .until(exitInstant, { largestUnit: "hours" })
        .toString(),
      enter: enter.toString(),
      exit: leave.toString(),
      calendarDays,
    };
  } catch {
    return null;
  }
}
