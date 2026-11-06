import { Temporal } from "../../internal/temporal";
// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import {
  resolveUnixEpochUnitOptions,
  toUnixEpoch,
} from "../../internal/unixEpochValue";
import {
  addLengthToStart,
  readLengthUnits,
  utcLengthFrame,
} from "../../internal/lengthFromNow";
import { isValidDateTimeDurationUnit } from "../../plain/validate/isValidDateTimeDurationUnit";
import type { DateTimeDurationUnit } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Return the Unix epoch after now, counted from the current time in UTC.
 *
 * - Reads the clock once, after `units` and `options` are checked.
 * - `units` is an object of unit amounts, such as `{ days: 90 }`. A duration string returns
 *   null, and so does a fractional amount: write `{ hours: 36 }` for a day and a half.
 * - Lengths are unsigned: a negative amount returns null. `getUnixAgo` is the way back.
 * - `{ days: 0 }` is a valid length and gives now.
 * - Calendar units count in UTC, so the result does not change with the server's zone, and a
 *   missing day clamps to the end of the month, as `addUnix` does. For another zone's wall clock,
 *   use `getZonedIn` and convert.
 * - A `timeZone` member is not read, as `getUnixNow` reads none.
 * - A timer delay is `totalUnitsFromNow(units, "milliseconds")`. Writing
 *   `getUnixIn(units) - getUnixNow()` reads the clock twice and misses null.
 * - Each call reads the clock. To pin the start, use `addUnix(getUnixNow(), units)`.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @param options optional: the unit of the result
 * @returns the Unix epoch, or null for invalid `units`, a negative amount, invalid `options` or a
 *   result outside Temporal's range
 *
 * @example getUnixIn({ days: 90 }, { epochUnit: "seconds" }) // 1820836800 (an expiry 90 days out, from a clock at 2027-06-15T12:00:00Z)
 * @example getUnixIn({ days: 90 }) // 1820836800000 (milliseconds, the default)
 * @example getUnixIn({ days: -1 }) // null (lengths are unsigned)
 * @example getUnixIn({ fortnights: 1 } as never) // null (not a unit)
 * @example getUnixIn({ days: 1 }, { epochUnit: "minutes" } as never) // null (not a UnixUnit)
 */
export function getUnixIn(
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    /**
     * The unit of the returned epoch: `"seconds"` or `"milliseconds"`, singular or plural.
     * Any other value returns `null`. Seconds floor toward −∞, and a JWT `exp` needs them: the
     * default is milliseconds, and a millisecond `exp` reads as a date far in the future.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
  },
): number | null {
  try {
    const epochUnit = resolveUnixEpochUnitOptions(options);
    if (epochUnit === null) {
      return null;
    }

    const amounts = readLengthUnits(units, isValidDateTimeDurationUnit);
    if (amounts === null) {
      return null;
    }

    return toUnixEpoch(
      addLengthToStart(Temporal.Now.instant(), amounts, utcLengthFrame()),
      epochUnit,
    );
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return null;
  }
}
