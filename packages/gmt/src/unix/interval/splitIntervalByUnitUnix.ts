import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";
import {
  parseUnixEpochInterval,
  resolveDurationUnit,
  tileByUnit,
} from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { minSlicesForSpan } from "../../internal/splitStep";

/**
 * Split a Unix epoch interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval, each record's `end`
 *   equal to the next record's `start`.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Calendar-unit boundaries (years, months, weeks, days) are computed from `start`
 *   (`start + k × amount`, as Temporal and Luxon's `Interval.splitBy` do), so month-end starts
 *   don't drift: a monthly split from January 31 lands on February 29, March 31, April 30.
 * - Exact-unit boundaries (hours and smaller) step from the previous boundary. Exact units never
 *   clamp, and stepping keeps nanosecond precision where `k × amount` would pass
 *   `Number.MAX_SAFE_INTEGER` (boundaries are then floored to milliseconds).
 * - A calendar step that resolves to the same instant as the previous boundary (a deleted local
 *   day, such as 30 December 2011 in `Pacific/Apia`) is skipped, so no empty slice is produced.
 *   A step that goes backwards returns `[]`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (`start`/`end` that is not a safe integer or numeric string of
 *   one — fractions, empty strings and values beyond ±(2^53 − 1) are invalid — unsupported unit,
 *   or non-positive amount), and when the system time zone cannot be resolved.
 *
 * Reads `start` and `end` as epoch milliseconds (there is no `epochUnit` option) and uses the
 * system time zone for calendar-unit arithmetic (there is no `timeZone` option).
 * - `options.maxPieces` (positive safe integer, default `1_000_000`) bounds the output: a split
 *   into more slices returns `[]`, decided from the span before stepping where it can be, and
 *   otherwise as soon as slice `maxPieces + 1` is due. An invalid `maxPieces` also returns `[]`.
 *
 * @param start Unix epoch milliseconds — interval start
 * @param end Unix epoch milliseconds — interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @param options optional: `maxPieces` (positive safe integer, default `1_000_000`)
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6) // [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
 * @example splitIntervalByUnitUnix(0, 3600000, "hour", 1) // [{ start: 0, end: 3600000 }]
 * @example splitIntervalByUnitUnix(0, 0, "hour", 1) // [{ start: 0, end: 0 }]
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 0) // []
 * @example splitIntervalByUnitUnix("invalid", 86400000, "hour", 1) // []
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6, { maxPieces: 3 }) // [] (4 slices exceed the limit)
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6, { maxPieces: 4 }) // [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
 */
export function splitIntervalByUnitUnix(
  start: number | string,
  end: number | string,
  unit: string,
  amount: number,
  options?: { maxPieces?: number },
): Array<{ start: number; end: number }> {
  const interval = parseUnixEpochInterval(start, end);

  if (interval === null) {
    return [];
  }

  const { start: startMs, end: endMs } = interval;

  if (typeof unit !== "string") {
    return [];
  }

  const resolvedUnit = resolveDurationUnit(unit);

  if (!resolvedUnit) {
    return [];
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const maxPieces = resolveMaxPieces(options);

  if (maxPieces === null) {
    return [];
  }

  try {
    const timeZone = getSystemTimeZone();
    if (!timeZone || !isValidTimeZone(timeZone)) {
      return [];
    }

    if (startMs === endMs) {
      return [{ start: startMs, end: endMs }];
    }

    const startZoned =
      Temporal.Instant.fromEpochMilliseconds(startMs).toZonedDateTimeISO(
        timeZone,
      );
    const endZoned =
      Temporal.Instant.fromEpochMilliseconds(endMs).toZonedDateTimeISO(
        timeZone,
      );

    const spanNs = (endMs - startMs) * 1_000_000;

    if (
      exceedsPieceLimit(
        minSlicesForSpan(spanNs, resolvedUnit, amount, true),
        maxPieces,
      )
    ) {
      return [];
    }

    // Boundaries stay ZonedDateTime (nanosecond) values; only the output is floored to ms.
    const slices = tileByUnit(
      startZoned,
      endZoned,
      Temporal.ZonedDateTime.compare,
      resolvedUnit,
      amount,
      maxPieces,
    );

    return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
      start: sliceStart.epochMilliseconds,
      end: sliceEnd.epochMilliseconds,
    }));
  } catch {
    return [];
  }
}
