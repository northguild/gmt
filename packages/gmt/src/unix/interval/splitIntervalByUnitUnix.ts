// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { resolveDurationUnit, tileByUnit } from "../../internal";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { resolveUnixIntervalPair } from "../../internal/resolveUnixIntervalPair";
import { minSlicesForSpan, stepNoFinerThan } from "../../internal/splitStep";
import { toUnixEpoch } from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";

/**
 * Split a Unix epoch interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of half-open `[start, end)` records that tile the interval: each record's
 *   `end` is the next record's `start` and belongs only to that next record, so the pieces share
 *   no value and together cover `[start, end)` exactly once.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Calendar-unit boundaries (years, months, weeks, days) are computed from `start`
 *   (`start + k × amount`), so month-end starts don't drift: a monthly split from January 31
 *   lands on February 29, March 31, April 30. Temporal's `add` constrains a day the month lacks
 *   to the month's last day, and stepping from that boundary would keep the shortened day
 *   (February 29, then March 29).
 * - Comparison: Luxon's `Interval.splitBy` computes each boundary from the start the same way.
 * - Exact-unit boundaries (hours and smaller) step from the previous boundary. Exact units never
 *   clamp, and stepping keeps nanosecond precision where `k × amount` would pass
 *   `Number.MAX_SAFE_INTEGER` (boundaries are then floored to milliseconds).
 * - A calendar step that resolves to the same instant as the previous boundary (a deleted local
 *   day, such as 30 December 2011 in `Pacific/Apia`) is skipped, so no empty slice is produced.
 *   A step that goes backwards returns `[]`.
 * - A step finer than `epochUnit` (500 milliseconds when the epochs are seconds, any microsecond
 *   or nanosecond step shorter than a millisecond) cannot be written in that unit: its boundaries
 *   floor to every whole unit from `start` to `end`, so the pieces are one `epochUnit` long and
 *   none is empty. `maxPieces` counts those pieces.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (`start`/`end` that is not a safe integer or numeric string of
 *   one — fractions, empty strings and values beyond ±(2^53 − 1) are invalid — unsupported unit,
 *   non-positive amount, an invalid `epochUnit` or an unknown `timeZone`).
 *
 * - `start` and `end` are each a safe integer or a string of optionally negative ASCII digits.
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - A split into more than `options.maxPieces` slices returns `[]`, decided from the span before
 *   stepping where it can be, and otherwise as soon as slice `maxPieces + 1` is due.
 *
 * @param start Unix epoch in `epochUnit` — interval start
 * @param end Unix epoch in `epochUnit` — interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`, singular or plural
 * @param amount positive number of units per step
 * @param options optional: the limit on the number of slices, how the epochs are read and the zone calendar steps run in
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6) // [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
 * @example splitIntervalByUnitUnix(0, 3600000, "hour", 1) // [{ start: 0, end: 3600000 }]
 * @example splitIntervalByUnitUnix(0, 0, "hour", 1) // [{ start: 0, end: 0 }]
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 0) // []
 * @example splitIntervalByUnitUnix("invalid", 86400000, "hour", 1) // []
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6, { maxPieces: 3 }) // [] (4 slices exceed the limit)
 * @example splitIntervalByUnitUnix(0, 86400000, "hour", 6, { maxPieces: 4 }) // [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
 * @example splitIntervalByUnitUnix(1710046800000, 1710216000000, "day", 1, { timeZone: "America/New_York" }) // [{ start: 1710046800000, end: 1710129600000 }, { start: 1710129600000, end: 1710216000000 }] (the first local day is 23 hours)
 * @example splitIntervalByUnitUnix("0", "86400", "hours", 12, { epochUnit: "second" }) // [{ start: 0, end: 43200 }, { start: 43200, end: 86400 }]
 * @example splitIntervalByUnitUnix(0, 2, "millisecond", 500, { epochUnit: "seconds" }) // [{ start: 0, end: 1 }, { start: 1, end: 2 }] (a step finer than the epoch unit gives one-second pieces)
 */
export function splitIntervalByUnitUnix(
  start: number | string,
  end: number | string,
  unit: string,
  amount: number,
  options?: {
    /**
     * The most pieces the result may hold. A split into more returns `[]` instead of building them.
     * A value that is not a positive safe integer also returns `[]`.
     *
     * @defaultValue `1_000_000`
     */
    maxPieces?: number;
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `[]`. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the calendar arithmetic runs in: an IANA name, a UTC offset, or `"local"` for
     * the system time zone. An unknown zone returns `[]`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): Array<{
  /**
   * The instant the interval begins at, as a Unix epoch number counted in `epochUnit`. A boundary
   * that falls between two whole units is rounded down to the earlier one.
   */
  start: number;
  /**
   * The first instant after the interval, counted in `epochUnit` and rounded as `start` is. It is
   * exclusive: the interval holds everything from `start` up to but not including this value. It
   * can equal `start`, which makes the interval empty.
   */
  end: number;
}> {
  try {
    const pair = resolveUnixIntervalPair(start, end, unit, options);

    if (pair === null) {
      return [];
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return [];
    }

    const maxPieces = resolveMaxPieces(options);

    if (maxPieces === null) {
      return [];
    }

    const { startVal, endVal, epochUnit } = pair;
    // Temporal's plural duration field name, as the tiling steps add `{ [unit]: amount }`. A step
    // finer than the epoch unit would floor neighbouring boundaries to one value (an empty slice),
    // so it steps by one epoch unit instead.
    const [resolvedUnit, stepAmount] = stepNoFinerThan(
      resolveDurationUnit(pair.resolvedUnit),
      amount,
      epochUnit,
    );

    if (startVal.epochNanoseconds === endVal.epochNanoseconds) {
      return [
        {
          start: toUnixEpoch(startVal, epochUnit),
          end: toUnixEpoch(endVal, epochUnit),
        },
      ];
    }

    try {
      const spanNs = Number(
        endVal.epochNanoseconds - startVal.epochNanoseconds,
      );

      if (
        exceedsPieceLimit(
          minSlicesForSpan(spanNs, resolvedUnit, stepAmount, true),
          maxPieces,
        )
      ) {
        return [];
      }

      // Boundaries stay ZonedDateTime (nanosecond) values; only the output is floored to epochUnit.
      const slices = tileByUnit(
        startVal,
        endVal,
        Temporal.ZonedDateTime.compare,
        resolvedUnit,
        stepAmount,
        maxPieces,
      );

      return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
        start: toUnixEpoch(sliceStart, epochUnit),
        end: toUnixEpoch(sliceEnd, epochUnit),
      }));
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
