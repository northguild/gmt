import { Temporal } from "@js-temporal/polyfill";
import {
  isOptionsArgument,
  observesDaylightTime,
  parseInstantNanoseconds,
  zoneFrame,
} from "../../internal";

/**
 * Check whether a timeZone observes daylight saving time at a reference instant.
 *
 * - True when the zone is in daylight time at the reference instant, or a daylight period begins
 *   less than 365 days after it. So a zone in its winter is true, and a zone that has stopped
 *   changing its clocks is false.
 * - With `options.at` the answer does not depend on the day the code runs.
 * - The rule is GMT's own definition, not the tz database's daylight flag, which no JavaScript
 *   API exposes: daylight time runs from a forward change of the zone's clocks to the backward
 *   change of the same size that undoes it, less than 365 days later.
 * - Read as standard time, because the offsets do not show otherwise: the last summer before a
 *   zone kept its daylight offset for good; a daylight period held 365 days or longer; one that
 *   began, ended or was interrupted by a move of standard time, so the offset changes part-way
 *   through and the rest, or all, of it is not paired (`Asia/Tomsk` 2002); and one whose end is
 *   past the last instant Temporal can represent.
 * - A forward change never undone is a change of standard time: `Europe/Istanbul` is false from
 *   2016 on, although its clocks went forward in March 2016.
 * - Read from the runtime's time zone data, so the answer can change when that data does.
 * - Returns false for an invalid timeZone, an invalid `at`, an options argument that is not an
 *   object, and a fixed UTC offset, with or without seconds (`"+05:30"`, `"-00:44:30"`).
 *
 * @param timeZone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or a
 *   stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @param options optional setting for the reference instant
 * @returns boolean indicating whether the timeZone observes DST, or false on invalid input
 *
 * @example hasDaylightSaving("America/New_York", { at: "2024-01-15T12:00:00Z" }) // true
 * @example hasDaylightSaving("Australia/Sydney", { at: "2024-06-15T12:00:00Z" }) // true (winter; the next period begins in October)
 * @example hasDaylightSaving("Asia/Tokyo", { at: "2024-01-15T12:00:00Z" }) // false
 * @example hasDaylightSaving("Europe/Istanbul", { at: "2015-06-15T12:00:00Z" }) // true
 * @example hasDaylightSaving("Europe/Istanbul", { at: "2016-06-15T12:00:00Z" }) // false (the March 2016 advance was never undone)
 * @example hasDaylightSaving("America/Sao_Paulo", { at: "2018-06-15T12:00:00Z" }) // true
 * @example hasDaylightSaving("America/Sao_Paulo", { at: "2019-06-15T12:00:00Z" }) // false (last daylight period ended 2019-02-17)
 * @example hasDaylightSaving("UTC", { at: "2024-01-15T12:00:00Z" }) // false
 * @example hasDaylightSaving("+05:00", { at: "2024-01-15T12:00:00Z" }) // false
 * @example hasDaylightSaving("Invalid/Zone", { at: "2024-01-15T12:00:00Z" }) // false
 * @example hasDaylightSaving("America/New_York", { at: "2024-01-15" }) // false (not an instant)
 * @example hasDaylightSaving("-00:44:30", { at: "1970-01-01T12:00:00Z" }) // false (a fixed offset)
 */
export function hasDaylightSaving(
  timeZone: string,
  options?: {
    /**
     * The reference instant the zone is judged at, as an ISO 8601 instant string ending in `Z`, an
     * offset or a bracketed zone. It only names an instant, as `isValidInstant` reads it: a
     * bracketed zone is not validated and does not replace `timeZone`. An invalid value returns
     * false.
     *
     * @defaultValue The current instant.
     */
    at?: string;
  },
): boolean {
  const frame = zoneFrame(timeZone);

  // A stored offset with seconds is a fixed offset: it observes no daylight time, as "-00:45"
  // observes none.
  if (
    frame === null ||
    frame.shiftNanoseconds !== 0n ||
    !isOptionsArgument(options)
  ) {
    return false;
  }

  try {
    const at = options?.at;
    if (at === undefined) {
      return observesDaylightTime(
        Temporal.Now.zonedDateTimeISO(frame.timeZone),
      );
    }

    const epochNanoseconds = parseInstantNanoseconds(at);
    if (epochNanoseconds === null) {
      return false;
    }

    return observesDaylightTime(
      Temporal.Instant.fromEpochNanoseconds(
        epochNanoseconds,
      ).toZonedDateTimeISO(frame.timeZone),
    );
  } catch {
    return false;
  }
}
