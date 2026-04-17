import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return an array of plain ISO date strings covering the inclusive date range between two zoned datetimes.
 *
 * - Both datetimes must have the same timezone.
 * - Returns [] for invalid inputs, mismatched timezones, start > end, or invalid step.
 *
 * @param startZonedDateTime start zoned ISO 8601 datetime string
 * @param endZonedDateTime end zoned ISO 8601 datetime string
 * @param stepDays optional positive integer step in days
 * @returns array of ISO date strings or [] when invalid
 *
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]") // ["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]", 2) // ["2024-02-28", "2024-03-01"]
 * @example mapZonedDatesInRange("invalid", "2024-03-02T12:00:00+00:00[UTC]") // []
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

  try {
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
  } catch {
    return [];
  }
}
