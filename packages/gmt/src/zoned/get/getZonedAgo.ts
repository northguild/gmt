import { readLengthUnits } from "../../internal/lengthFromNow";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";
import { subtractFromZoned } from "../../internal/zonedWallClockOperations";
import { isDateTimeDurationUnitName } from "../../internal/unitNames";
import type { DateTimeDurationUnit } from "../../types";
import { isZoneId } from "../../internal/inputChecks";

/**
 * Return the zoned datetime before now in `timeZone`, counted from the current time.
 *
 * - Zone first, as `getZonedNow`. An invalid zone, or an offset with seconds (`-00:44:30`), returns
 *   "": a written zone cannot carry seconds (RFC 9557 §4.1).
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts, such as `{ days: 90 }`. A duration string returns "". A
 *   fractional amount returns "": write `{ days: 1, hours: 12 }` for a day and a half, which keeps
 *   the day on the wall clock across a clock change.
 * - Lengths are unsigned: a negative amount returns "". `getZonedIn` counts forward.
 * - `{ days: 0 }` is a valid length and gives now.
 * - Calendar units count on `timeZone`'s wall clock, and a missing day clamps to the end of the
 *   month, as `subtractZoned` does. A result in a gap moves later and one on a repeated time
 *   takes the earlier (`"compatible"`, LOCAL_TIME_RESOLUTION), unless the length has no date part,
 *   which counts exact time.
 * - Whole seconds, floored. For sub-seconds, write
 *   `subtractZoned(getZonedNow(timeZone, { smallestUnit: "nanosecond" }), units)`.
 * - The pinned route, which also fixes the start, is `subtractZoned(getZonedNow(timeZone), units)`.
 * - Examples read the clock at 2027-06-15T12:00:00Z.
 *
 * @param timeZone IANA name or a UTC offset to the minute (what `isValidTimeZone` accepts)
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns zoned ISO 8601 datetime string in whole seconds, or "" for an invalid zone or `units`, a
 *   negative amount or a result outside Temporal's range
 *
 * @example getZonedAgo("Asia/Tokyo", { days: 90 }) // "2027-03-17T21:00:00+09:00[Asia/Tokyo]" (90 days back, 21:00 in Tokyo)
 * @example getZonedAgo("UTC", { days: 0 }) // "2027-06-15T12:00:00+00:00[UTC]" (now)
 * @example getZonedAgo("Mars/Olympus", { days: 1 }) // "" (not a zone)
 * @example getZonedAgo("Asia/Tokyo", { days: -1 }) // "" (lengths are unsigned)
 */
export function getZonedAgo(
  timeZone: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  try {
    if (!isZoneId(timeZone)) {
      return "";
    }
    const amounts = readLengthUnits(units, isDateTimeDurationUnitName);
    if (amounts === null) {
      return "";
    }

    return subtractFromZoned(nowZonedDateTimeISO(timeZone), amounts, {
      overflow: "constrain",
    }).toString({ smallestUnit: "second", roundingMode: "floor" });
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
