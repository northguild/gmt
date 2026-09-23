// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Return an array of plain ISO date strings covering the inclusive date range between two zoned datetimes.
 *
 * - Both datetimes must have the same timezone.
 * - Returns [] for invalid inputs, mismatched timezones, start > end, or invalid step.
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: when the
 *   range holds more dates than that, it returns `[]` without generating any. An invalid
 *   `maxPieces` also returns `[]`.
 * - An explicit `undefined` `stepDays` is the default step, so `(start, end, undefined, options)`
 *   reaches `options`. **Compatibility:** before 1.16.0 it returned `[]`.
 * - **End-inclusive, where the `interval*` functions are half-open.** This enumerates the dates a
 *   range covers, so the end date is one of them; an interval bounds a span as `[start, end)`, so
 *   its `end` is not. The same pair therefore yields one more date here than `intervalCountZoned`
 *   counts.
 *
 * @param startZonedDateTime start zoned ISO 8601 datetime string
 * @param endZonedDateTime end zoned ISO 8601 datetime string
 * @param stepDays optional positive integer step in days
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of ISO date strings or [] when invalid
 *
 * @example mapZonedDatesInRange("+275760-09-12T00:00:00+00:00[UTC]", "+275760-09-13T00:00:00+00:00[UTC]") // ["+275760-09-12", "+275760-09-13"] (a range ending on the maximum instant)
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]") // ["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]", 2) // ["2024-02-28", "2024-03-01"]
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-01T12:00:00+00:00[UTC]", undefined) // ["2024-02-28", "2024-02-29", "2024-03-01"] (undefined is the default step)
 * @example mapZonedDatesInRange("invalid", "2024-03-02T12:00:00+00:00[UTC]") // []
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]", 1, { maxPieces: 3 }) // [] (more dates than the limit)
 * @example mapZonedDatesInRange("2024-02-28T12:00:00+00:00[UTC]", "2024-03-02T12:00:00+00:00[UTC]", 1, { maxPieces: 10 }) // ["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]
 */
export function mapZonedDatesInRange(
  startZonedDateTime: string,
  endZonedDateTime: string,
  stepDays?: number,
  options?: { maxPieces?: number },
): string[] {
  try {
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
        start = zonedDateTimeFrom(startZonedDateTime);
        end = zonedDateTimeFrom(endZonedDateTime);
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

      const count =
        Math.floor(startDate.until(endDate).days / resolvedStepDays) + 1;

      if (exceedsPieceLimit(count, maxPieces)) {
        return [];
      }

      // Each date is anchored at the start (start + k·step) and only the `count` in-range dates are
      // built, so no step past the end is taken — a range ending on Temporal's date limit keeps its
      // dates instead of throwing on the step after the last one.
      const result: string[] = [];
      for (let index = 0; index < count; index++) {
        result.push(
          startDate.add({ days: index * resolvedStepDays }).toString(),
        );
      }

      return result;
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
