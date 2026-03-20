import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

export function mapDatesInRange(
  startDate: string,
  endDate: string,
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

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return [];
  }

  const start = Temporal.PlainDate.from(startDate);
  const end = Temporal.PlainDate.from(endDate);

  if (Temporal.PlainDate.compare(start, end) === 1) {
    return [];
  }

  const result: string[] = [];
  for (
    let current = start;
    Temporal.PlainDate.compare(current, end) <= 0;
    current = current.add({ days: resolvedStepDays })
  ) {
    result.push(current.toString());
  }

  return result;
}
