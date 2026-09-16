import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Return an array of ISO PlainDate strings between `startDate` and `endDate` inclusive.
 *
 * - Generates dates with optional step (default 1 day).
 * - Returns [] if start > end, invalid inputs, or step <= 0.
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when the
 *   range holds more dates than that, it returns `[]` without generating any. An invalid
 *   `maxPieces` also returns `[]`. Pass `stepDays` explicitly to reach `options`.
 *
 * @param startDate ISO PlainDate string for the first date
 * @param endDate ISO PlainDate string for the last date (inclusive)
 * @param stepDays optional number of days to step between results
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of ISO PlainDate strings, or [] on invalid input
 *
 * @example mapDatesInRange("2024-03-01", "2024-03-05") // ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 2) // ["2024-03-01", "2024-03-03", "2024-03-05"]
 * @example mapDatesInRange("2024-03-05", "2024-03-01") // []
 * @example mapDatesInRange("invalid", "2024-03-05") // []
 * @example mapDatesInRange("2024-03-01", "invalid") // []
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 0) // []
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 1, { maxPieces: 3 }) // [] (more dates than the limit)
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 1, { maxPieces: 10 }) // ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]
 */
export function mapDatesInRange(
  startDate: string,
  endDate: string,
  ...stepDaysInput: [stepDays?: number, options?: { maxPieces?: number }]
): string[] {
  const resolvedStepDays = stepDaysInput.length === 0 ? 1 : stepDaysInput[0];

  if (
    typeof resolvedStepDays !== "number" ||
    !Number.isInteger(resolvedStepDays) ||
    resolvedStepDays <= 0
  ) {
    return [];
  }

  const maxPieces = resolveMaxPieces(stepDaysInput[1]);

  if (maxPieces === null) {
    return [];
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return [];
  }
  try {
    const start = Temporal.PlainDate.from(startDate);
    const end = Temporal.PlainDate.from(endDate);

    if (Temporal.PlainDate.compare(start, end) === 1) {
      return [];
    }

    const count = Math.floor(start.until(end).days / resolvedStepDays) + 1;

    if (exceedsPieceLimit(count, maxPieces)) {
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
  } catch {
    return [];
  }
}
