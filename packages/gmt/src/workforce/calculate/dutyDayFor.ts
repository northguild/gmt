import { Temporal } from "../../internal/temporal";
import { isObject, parseInstantNanoseconds, zoneFrame } from "../../internal";
import {
  operatorDayScale,
  parseDayStartTime,
} from "../../internal/dutyPeriods";
import { parseScheduleDisambiguation } from "../../internal/operatingSchedule";
import type { DutyDay, Interval } from "../../types";

/**
 * Return the operator-designated day an instant falls in: from the most recent `dayStartTime`
 * in `timeZone` at or before the instant, up to (not including) the next one.
 *
 * The day an hours-of-work rule counts is the operator's, not the local midnight where the
 * person happens to be, so the reference zone and the start time are both the caller's and
 * neither has a default.
 *
 * - A `dayStartTime` that a clock change skips or repeats is resolved under `day.disambiguation`,
 *   the CORE-4 policy in `resolveLocal`. The default, `"compatible"`, reads a skipped time after
 *   the gap (02:30 on New York's spring-forward day is 03:30) and a repeated one at its first
 *   pass. The day that holds the change is then shorter or longer by the change: 23 or 25 hours
 *   across a one-hour change, 24.5 across Lord Howe's 30-minute fall-back, 21 across Casey's
 *   three-hour jump. `"reject"` returns `null` for
 *   a day that starts or ends at such a time.
 * - The instant is read in `timeZone` whatever offset or zone it is written with, so a log whose
 *   entries cross zones still falls into the reference zone's days.
 * - A date whose start resolves onto the next date's start opens no day: the date
 *   `Pacific/Apia` deleted in 2011 is part of no operator day.
 * - Returns `null` when `instant` is not an ISO 8601 instant string, when `day` is not an object
 *   with a valid `timeZone` and a `dayStartTime` that `isValidTime` accepts, and when the day or
 *   the next one starts outside Temporal's instant range.
 *
 * @param instant ISO 8601 instant string to place
 * @param day the reference zone and the local time each day starts at
 * @returns `{ start, end }` of the day as UTC instants ending in "Z", or null on invalid input
 *
 * @example dutyDayFor("2024-01-01T08:59:00Z", { timeZone: "America/New_York", dayStartTime: "04:00" }) // { start: "2023-12-31T09:00:00Z", end: "2024-01-01T09:00:00Z" } — 03:59 local is the previous day
 * @example dutyDayFor("2024-01-01T09:00:00Z", { timeZone: "America/New_York", dayStartTime: "04:00" }) // { start: "2024-01-01T09:00:00Z", end: "2024-01-02T09:00:00Z" }
 * @example dutyDayFor("2024-03-10T12:00:00Z", { timeZone: "America/New_York", dayStartTime: "02:30" }) // { start: "2024-03-10T07:30:00Z", end: "2024-03-11T06:30:00Z" } — 02:30 is skipped, read as 03:30; 23 hours
 * @example dutyDayFor("2024-11-03T12:00:00Z", { timeZone: "America/New_York", dayStartTime: "01:30" }) // { start: "2024-11-03T05:30:00Z", end: "2024-11-04T06:30:00Z" } — 01:30 is repeated, the first pass starts it; 25 hours
 * @example dutyDayFor("2024-11-03T12:00:00Z", { timeZone: "America/New_York", dayStartTime: "01:30", disambiguation: "later" }) // { start: "2024-11-03T06:30:00Z", end: "2024-11-04T06:30:00Z" } — the second pass; 24 hours
 * @example dutyDayFor("2024-11-03T12:00:00Z", { timeZone: "America/New_York", dayStartTime: "01:30", disambiguation: "reject" }) // null — the day starts at a repeated time
 * @example dutyDayFor("2024-01-01T12:00:00Z", { timeZone: "UTC" }) // null — no dayStartTime
 * @example dutyDayFor("2024-01-01T12:00:00Z", { timeZone: "Invalid/Zone", dayStartTime: "04:00" }) // null
 */
export function dutyDayFor(instant: string, day: DutyDay): Interval | null {
  try {
    if (typeof instant !== "string" || !isObject(day)) {
      return null;
    }

    const { timeZone, dayStartTime } = day as {
      timeZone?: unknown;
      dayStartTime?: unknown;
    };
    const disambiguation = parseScheduleDisambiguation(day);
    const at = parseInstantNanoseconds(instant);
    const frame = zoneFrame(timeZone);
    const time = parseDayStartTime(dayStartTime);

    if (
      at === null ||
      frame === null ||
      time === null ||
      disambiguation === null
    ) {
      return null;
    }

    const span = operatorDayScale(frame, time, disambiguation).containing(at);

    if (span === null) {
      return null;
    }

    return {
      start: Temporal.Instant.fromEpochNanoseconds(span.start).toString(),
      end: Temporal.Instant.fromEpochNanoseconds(span.end).toString(),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
