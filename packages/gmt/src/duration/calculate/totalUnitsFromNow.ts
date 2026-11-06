import { Temporal } from "../../internal/temporal";
import type { DateTimeUnit } from "../../internal/temporalTypes";
import { isOptionsArgument } from "../../internal/isObject";
import {
  readLengthUnits,
  totalLengthFromStart,
} from "../../internal/lengthFromNow";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { normalizeZoneFrame } from "../../internal/zoneFrame";
import { isValidDateTimeDurationUnit } from "../../plain/validate/isValidDateTimeDurationUnit";
import type { DateTimeDurationUnit } from "../../types";

/**
 * Express a length of time from now as one fractional total in one unit.
 *
 * - Counts from the current time in UTC, so the result does not change with the server's zone.
 *   Pass `timeZone` to count calendar units on another zone's wall clock; a day in Paris can be
 *   23 hours. A result in a gap moves later and a repeated time takes the earlier
 *   (`"compatible"`, see LOCAL_TIME_RESOLUTION).
 * - `units` is an object of unit amounts, such as `{ months: 1 }`. A duration string returns null.
 *   A fractional amount returns null: write `{ hours: 36 }` for a day and a half. With `timeZone`,
 *   write `{ days: 1, hours: 12 }` instead, because the day then counts on the wall clock: across
 *   a spring-forward in Paris it totals 35 hours, not 36.
 * - Lengths are unsigned: a negative amount returns null.
 * - The result is fractional and unrounded, as `totalDuration` is. A cookie `Max-Age` must be
 *   whole digits (RFC 6265 section 5.2.2 ignores a value with a fraction), so a caller whose
 *   length holds sub-second units rounds first.
 * - A timer delay is `totalUnitsFromNow(units, "milliseconds")`. Writing
 *   `getUnixIn(units) - getUnixNow()` reads the clock twice and can subtract from null.
 * - Each call reads the clock. To pin the start, use
 *   `totalDuration(durationFromUnits(units), "seconds", { relativeTo })`, where `relativeTo` is a
 *   zoned string such as `getZonedNow("UTC")`. A `Z` string, such as `getUtcNow()`, returns null
 *   (Temporal section 13.19).
 * - `unit` accepts the plural or singular name, as `totalDuration` does.
 *
 * @param units unit amounts, such as `{ years: 1 }`; never negative
 * @param unit the unit to total into, plural or singular
 * @param options optional: the time zone calendar units count in
 * @returns the fractional total in `unit`, or null for invalid `units`, a negative amount, an
 *   invalid `unit` or `options`, or a length Temporal cannot total
 *
 * @example totalUnitsFromNow({ days: 90 }, "seconds") // 7776000 (a cookie Max-Age or HSTS max-age for 90 days)
 * @example totalUnitsFromNow({ days: 1 }, "seconds") // 86400 (UTC has no clock change)
 * @example totalUnitsFromNow({ milliseconds: 1500 }, "seconds") // 1.5 (fractional, unrounded)
 * @example totalUnitsFromNow({ days: -1 }, "seconds") // null (lengths are unsigned)
 * @example totalUnitsFromNow({ fortnights: 1 } as never, "seconds") // null (not a unit)
 * @example totalUnitsFromNow({ days: 1 }, "fortnights" as never) // null (not a unit)
 */
export function totalUnitsFromNow(
  units: Partial<Record<DateTimeDurationUnit, number>>,
  unit: DateTimeDurationUnit | DateTimeUnit,
  options?: {
    /**
     * The time zone calendar units count in: an IANA name, a UTC offset, or `"local"` for the
     * system time zone. An unknown zone returns `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const frame = normalizeZoneFrame(options?.timeZone);
    if (frame === null) {
      return null;
    }

    const resolvedUnit = resolveDurationUnit(unit);
    if (!isValidDateTimeDurationUnit(resolvedUnit)) {
      return null;
    }

    const amounts = readLengthUnits(units, isValidDateTimeDurationUnit);
    if (amounts === null) {
      return null;
    }

    return totalLengthFromStart(
      Temporal.Now.instant(),
      amounts,
      resolvedUnit,
      frame,
    );
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a length Temporal cannot total, is
    // invalid input, not an exception.
    return null;
  }
}
