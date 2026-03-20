import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

export function isBeforeZoned(value1: string, value2: string): boolean {
  if (!isValidZonedDateTime(value1) || !isValidZonedDateTime(value2)) {
    return false;
  }

  let zonedDateTime1: Temporal.ZonedDateTime;
  let zonedDateTime2: Temporal.ZonedDateTime;
  try {
    zonedDateTime1 = Temporal.ZonedDateTime.from(value1);
    zonedDateTime2 = Temporal.ZonedDateTime.from(value2);
  } catch {
    return false;
  }

  try {
    return (
      Temporal.Instant.compare(
        zonedDateTime1.toInstant(),
        zonedDateTime2.toInstant(),
      ) === -1
    );
  } catch {
    return false;
  }
}
