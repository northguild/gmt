import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return an array of ISO PlainDate strings between `startDate` and `endDate`
 * inclusive, stepping by `stepDays`.
 *
 * - `stepDays` defaults to 1 when omitted.
 * - Returns an empty array for invalid dates or invalid step values.
 *
 * @param startDate ISO PlainDate string for the first date
 * @param endDate ISO PlainDate string for the last date (inclusive)
 * @param stepDays optional number of days to step between results
 * @returns array of ISO PlainDate strings, or an empty array on invalid input
 */
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
