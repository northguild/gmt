import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

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
