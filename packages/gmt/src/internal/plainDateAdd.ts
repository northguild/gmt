import { Temporal } from "@js-temporal/polyfill";
import { calendarDateAdd } from "./temporalCompat";

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/**
 * `date.add(duration, { overflow })` for a PlainDate in any calendar.
 *
 * - `iso8601` is the polyfill's own `add`, untouched.
 * - Other calendars go through the Temporal compat layer's `calendarDateAdd` (CORE-6: the polyfill's
 *   calendar add throws near the range limits and is wrong in the corrected calendar ranges). Time
 *   fields become whole days exactly as TC39 `ToDateDurationRecordWithoutTime` does: the time
 *   duration in nanoseconds, truncated toward zero to 24-hour days, added to `days`.
 * - The duration is validated by `Temporal.Duration.from`, as `add` itself does.
 *
 * @param date PlainDate to add to
 * @param duration a DurationLike (negate it to subtract)
 * @param overflow "constrain" (default, as in Temporal) | "reject"
 * @returns the resulting PlainDate in `date`'s calendar; throws on invalid input or out of range
 *
 * @example plainDateAdd(Temporal.PlainDate.from("2024-01-31"), { months: 1 }, "constrain").toString() // "2024-02-29"
 * @example plainDateAdd(Temporal.PlainDate.from("2024-01-31"), { months: 1 }, "reject") // throws RangeError
 */
export function plainDateAdd(
  date: Temporal.PlainDate,
  duration: Temporal.Duration | Temporal.DurationLike,
  overflow: "constrain" | "reject" = "constrain",
): Temporal.PlainDate {
  if (date.calendarId === "iso8601") {
    return date.add(duration, { overflow });
  }
  const {
    years,
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    microseconds,
    nanoseconds,
  } = Temporal.Duration.from(duration);
  const timeNanoseconds =
    BigInt(hours) * NANOSECONDS_PER_HOUR +
    BigInt(minutes) * NANOSECONDS_PER_MINUTE +
    BigInt(seconds) * NANOSECONDS_PER_SECOND +
    BigInt(milliseconds) * 1_000_000n +
    BigInt(microseconds) * 1_000n +
    BigInt(nanoseconds);
  return calendarDateAdd(
    date,
    {
      years,
      months,
      weeks,
      days: days + Number(timeNanoseconds / NANOSECONDS_PER_DAY),
    },
    overflow,
  );
}
