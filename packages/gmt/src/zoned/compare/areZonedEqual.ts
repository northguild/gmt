import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Compare two zoned datetime strings for exact local-field equality.
 *
 * - Inputs must be valid ISO 8601 zoned datetime strings.
 * - Returns `true` when year/month/day/hour/minute/second/millisecond/microsecond/
 *   nanosecond and IANA timeZone id all match; otherwise `false`.
 * - Invalid inputs return `false`.
 *
 * @param value1 first zoned datetime string
 * @param value2 second zoned datetime string
 * @returns boolean indicating whether the two zoned datetimes are equal
 */
export function areZonedEqual(value1: string, value2: string): boolean {
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
      zonedDateTime1.year === zonedDateTime2.year &&
      zonedDateTime1.month === zonedDateTime2.month &&
      zonedDateTime1.day === zonedDateTime2.day &&
      zonedDateTime1.hour === zonedDateTime2.hour &&
      zonedDateTime1.minute === zonedDateTime2.minute &&
      zonedDateTime1.second === zonedDateTime2.second &&
      zonedDateTime1.millisecond === zonedDateTime2.millisecond &&
      zonedDateTime1.microsecond === zonedDateTime2.microsecond &&
      zonedDateTime1.nanosecond === zonedDateTime2.nanosecond &&
      zonedDateTime1.timeZoneId === zonedDateTime2.timeZoneId
    );
  } catch {
    return false;
  }
}

export const areZonedDateTimesEqual = areZonedEqual;
