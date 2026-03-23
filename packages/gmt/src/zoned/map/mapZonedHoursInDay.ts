import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of zoned datetime strings representing each hour boundary
 * for the 24-hour window starting at midnight of the anchor's local day.
 *
 * - Accounts for days longer/shorter than 24 hours due to DST shifts.
 * - Returns an empty array for invalid anchor input.
 *
 * @param anchor zoned ISO 8601 datetime string used as anchor
 * @returns array of zoned ISO 8601 strings for each hour in the day
 */
export function mapZonedHoursInDay(anchor: string): string[] {
  if (!isValidZonedDateTime(anchor)) {
    return [];
  }

  let zonedDateTime: Temporal.ZonedDateTime;
  try {
    zonedDateTime = Temporal.ZonedDateTime.from(anchor);
  } catch {
    return [];
  }

  const start = zonedDateTime.with({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  });
  const nextDay = start.add({ days: 1 });

  const result: string[] = [];
  for (
    let current = start;
    Temporal.Instant.compare(current.toInstant(), nextDay.toInstant()) < 0;
    current = current.add({ hours: 1 })
  ) {
    result.push(current.toString());
  }

  return result;
}
