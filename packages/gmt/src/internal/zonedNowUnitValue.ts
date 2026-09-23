import { Temporal } from "@js-temporal/polyfill";

/**
 * One field of a zoned "now" as the `get*NowUnit` accessors return it: zero-padded to two digits
 * (three for sub-second fields), the year and day of week unpadded. The week number is the
 * caller's, since the plain and zoned accessors read it through `parseWeekFromDate` and the utc and
 * unix ones from the ISO date.
 *
 * @param now the current moment on the wall clock being read
 * @param unit a singular unit, `dayOfWeek` included (already validated by the caller)
 * @param week the week number for `now`, as a string
 * @returns the field, or "" for any other unit
 * @example zonedNowUnitValue(Temporal.ZonedDateTime.from("2024-03-05T07:08:09.012+00:00[UTC]"), "millisecond", () => "10") // "012"
 * @example zonedNowUnitValue(Temporal.ZonedDateTime.from("2024-03-05T07:08:09+00:00[UTC]"), "week", () => "10") // "10"
 * @example zonedNowUnitValue(Temporal.ZonedDateTime.from("2024-03-05T07:08:09+00:00[UTC]"), "quarter", () => "10") // ""
 */
export function zonedNowUnitValue(
  now: Temporal.ZonedDateTime,
  unit: string | null | undefined,
  week: (now: Temporal.ZonedDateTime) => string,
): string {
  switch (unit) {
    case "year":
      return now.year.toString();
    case "month":
      return now.month.toString().padStart(2, "0");
    case "week":
      return week(now);
    case "day":
      return now.day.toString().padStart(2, "0");
    case "dayOfWeek":
      return now.dayOfWeek.toString();
    case "hour":
      return now.hour.toString().padStart(2, "0");
    case "minute":
      return now.minute.toString().padStart(2, "0");
    case "second":
      return now.second.toString().padStart(2, "0");
    case "millisecond":
      return now.millisecond.toString().padStart(3, "0");
    case "microsecond":
      return (now.microsecond ?? 0).toString().padStart(3, "0");
    case "nanosecond":
      return (now.nanosecond ?? 0).toString().padStart(3, "0");
    default:
      return "";
  }
}

/**
 * The ISO 8601 week number of `now`'s date, the week the utc and unix `get*NowUnit` accessors read.
 *
 * @param now the current moment on the wall clock being read
 * @returns the week number as a string
 * @example isoWeekOfYear(Temporal.ZonedDateTime.from("2024-12-30T00:00:00+00:00[UTC]")) // "1"
 */
export function isoWeekOfYear(now: Temporal.ZonedDateTime): string {
  const plainDate = Temporal.PlainDate.from({
    year: now.year,
    month: now.month,
    day: now.day,
  });
  return (plainDate.weekOfYear ?? 0).toString();
}
