import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of plain ISO date strings covering the inclusive date range
 * between two zoned datetimes in the same timeZone.
 *
 * - `stepDays` is optional and defaults to 1; must be a positive integer.
 * - Returns empty array for invalid inputs, mismatched timeZones, or when
 *   start > end.
 *
 * @param startZonedDateTime start zoned ISO 8601 datetime string
 * @param endZonedDateTime end zoned ISO 8601 datetime string
 * @param stepDays optional positive integer step in days
 * @returns array of ISO date strings or empty array when invalid
 */
export function mapZonedDatesInRange(
  startZonedDateTime: string,
  endZonedDateTime: string,
  ...stepDaysInput: [stepDays?: number]
): string[] {
  const resolvedStepDays = stepDaysInput.length === 0 ? 1 : stepDaysInput[0];

  if (
    typeof resolvedStepDays !== "number" ||
    !Number.isInteger(resolvedStepDays) ||
    resolvedStepDays <= 0
  ) {
    return [];
  }

  if (
    !isValidZonedDateTime(startZonedDateTime) ||
    !isValidZonedDateTime(endZonedDateTime)
  ) {
    return [];
  }

  let start: Temporal.ZonedDateTime;
  let end: Temporal.ZonedDateTime;
  try {
    start = Temporal.ZonedDateTime.from(startZonedDateTime);
    end = Temporal.ZonedDateTime.from(endZonedDateTime);
  } catch {
    return [];
  }

  if (start.timeZoneId !== end.timeZoneId) {
    return [];
  }

  const startDate = start.toPlainDate();
  const endDate = end.toPlainDate();

  if (Temporal.PlainDate.compare(startDate, endDate) === 1) {
    return [];
  }

  const result: string[] = [];
  for (
    let current = startDate;
    Temporal.PlainDate.compare(current, endDate) <= 0;
    current = current.add({ days: resolvedStepDays })
  ) {
    result.push(current.toString());
  }

  return result;
}
