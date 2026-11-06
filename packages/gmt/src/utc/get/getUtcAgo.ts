import { Temporal } from "../../internal/temporal";
import {
  subtractLengthFromStart,
  readLengthUnits,
  utcLengthFrame,
} from "../../internal/lengthFromNow";
import { isValidDateTimeDurationUnit } from "../../plain/validate/isValidDateTimeDurationUnit";
import type { DateTimeDurationUnit } from "../../types";

/**
 * Return the UTC instant before now, as an ISO Instant string, counted from the current time.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts, such as `{ days: 90 }`. A duration string returns "". A
 *   fractional amount returns "": write `{ hours: 36 }` for a day and a half.
 * - Lengths are unsigned: a negative amount returns "". `getUtcIn` counts forward.
 * - `{ days: 0 }` is a valid length and gives now.
 * - Whole seconds, floored, always `Z`, so every form of one call names the same second. A caller
 *   who wants sub-seconds writes `subtractUtc(getUtcNow(), units)`.
 * - Calendar units count in UTC, so the result does not change with the server's zone, and a
 *   missing day clamps to the end of the month, as `subtractUtc` does. For another zone's wall
 *   clock, use `getZonedAgo`.
 * - It feeds `formatHttpDate`. A past `Expires` that deletes a cookie is
 *   `formatHttpDate(getUtcAgo({ days: 1 }))`: RFC 6265 §4.1.2 says servers can delete a cookie by
 *   sending one with an `Expires` in the past (§3.1).
 * - Each call reads the clock. To pin the start, use `subtractUtc(getUtcNow(), units)`.
 * - Examples read the clock at 2027-06-15T12:00:00Z.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns ISO Instant string in whole seconds, or "" for invalid `units`, a negative amount or a
 *   result outside Temporal's range
 *
 * @example getUtcAgo({ days: 90 }) // "2027-03-17T12:00:00Z" (90 days back)
 * @example getUtcAgo({ days: 1 }) // "2027-06-14T12:00:00Z" (feed it to formatHttpDate to delete a cookie)
 * @example getUtcAgo({ days: -1 }) // "" (lengths are unsigned)
 * @example getUtcAgo({ fortnights: 1 } as never) // "" (not a unit)
 */
export function getUtcAgo(
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  try {
    const amounts = readLengthUnits(units, isValidDateTimeDurationUnit);
    if (amounts === null) {
      return "";
    }

    return subtractLengthFromStart(
      Temporal.Now.instant(),
      amounts,
      utcLengthFrame(),
    ).toString({ smallestUnit: "second", roundingMode: "floor" });
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
