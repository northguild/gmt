import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

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
