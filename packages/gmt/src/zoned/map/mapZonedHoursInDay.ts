import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of zoned datetime strings representing each hour boundary for the 24-hour window starting at midnight of the anchor's local day.
 *
 * - Handles DST transitions by skipping non-existent hours.
 * - Returns [] for invalid input.
 *
 * @param anchor zoned ISO 8601 datetime string used as anchor
 * @returns array of zoned ISO 8601 strings for each hour in the day
 *
 * @example mapZonedHoursInDay("2024-02-29T12:34:56.789+00:00[UTC]") // ["2024-02-29T00:00:00+00:00[UTC]", "2024-02-29T01:00:00+00:00[UTC]", ..., "2024-02-29T23:00:00+00:00[UTC]"]
 * @example mapZonedHoursInDay("2024-03-10T12:34:56.789-05:00[America/New_York]") // ["2024-03-10T00:00:00-05:00[America/New_York]", ...] (skips 2 AM due to DST)
 * @example mapZonedHoursInDay("invalid") // []
 */
export function mapZonedHoursInDay(anchor: string): string[] {
  if (!isValidZonedDateTime(anchor)) {
    return [];
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(anchor);

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
  } catch {
    return [];
  }
}
