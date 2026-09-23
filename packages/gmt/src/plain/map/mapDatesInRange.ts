// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
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
 *   `maxPieces` also returns `[]`.
 * - An explicit `undefined` `stepDays` is the default step, so `(start, end, undefined, options)`
 *   reaches `options`. **Compatibility:** before 1.16.0 it returned `[]`.
 * - **End-inclusive, where the `interval*` functions are half-open.** This enumerates the dates a
 *   range covers, so `endDate` is one of them; an interval bounds a span as `[start, end)`, so its
 *   `end` is not. The same pair therefore yields one more date here than `intervalCountDate`
 *   counts. To read one set of bounds both ways, pass `addDate(endDate, { days: 1 })` to the
 *   `interval*` call, or `subtractDate(endDate, { days: 1 })` to this one.
 *
 * @param startDate ISO PlainDate string for the first date
 * @param endDate ISO PlainDate string for the last date (inclusive)
 * @param stepDays optional number of days to step between results
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of ISO PlainDate strings, or [] on invalid input
 *
 * @example mapDatesInRange("2024-03-01", "2024-03-05") // ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 2) // ["2024-03-01", "2024-03-03", "2024-03-05"]
 * @example mapDatesInRange("+275760-09-11", "+275760-09-13") // ["+275760-09-11", "+275760-09-12", "+275760-09-13"] (a range ending on the last representable date)
 * @example mapDatesInRange("2024-03-05", "2024-03-01") // []
 * @example mapDatesInRange("invalid", "2024-03-05") // []
 * @example mapDatesInRange("2024-03-01", "invalid") // []
 * @example mapDatesInRange("2024-03-01", "2024-03-03", undefined) // ["2024-03-01", "2024-03-02", "2024-03-03"] (undefined is the default step)
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 0) // []
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 1, { maxPieces: 3 }) // [] (more dates than the limit)
 * @example mapDatesInRange("2024-03-01", "2024-03-05", 1, { maxPieces: 10 }) // ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]
 */
export function mapDatesInRange(
  startDate: string,
  endDate: string,
  stepDays?: number,
  options?: { maxPieces?: number },
): string[] {
  // An explicit undefined is the omitted argument, as TC39 GetOption treats it.
  const resolvedStepDays = stepDays === undefined ? 1 : stepDays;

  if (
    typeof resolvedStepDays !== "number" ||
    !Number.isInteger(resolvedStepDays) ||
    resolvedStepDays <= 0
  ) {
    return [];
  }

  const maxPieces = resolveMaxPieces(options);

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

    // Each date is anchored at the start (start + k·step) and only the `count` in-range dates are
    // built, so no step past the end is taken — a range ending on Temporal's date limit keeps its
    // dates instead of throwing on the step after the last one.
    const result: string[] = [];
    for (let index = 0; index < count; index++) {
      result.push(start.add({ days: index * resolvedStepDays }).toString());
    }

    return result;
  } catch {
    return [];
  }
}
