import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  countZonedLocalDates,
  halfOpenIntersection,
  parseUnixEpochInterval,
} from "../../internal";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return how many distinct calendar dates two Unix epoch intervals share, in a given
 * time zone.
 *
 * - Counts the local dates that hold at least one instant of the half-open intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd))`. The end is excluded, so an intersection ending at
 *   local midnight does not touch the date that midnight starts.
 * - Uses `"UTC"` by default (consistent with `addUnix` and `intervalCountUnix`); `"local"` is the
 *   system zone and an unknown zone returns `null`.
 * - Each instant in the intersection contributes its own local date in `timeZone`, and each date
 *   counts once. A date the zone deleted is not counted (`Pacific/Apia` skipped 2011-12-30), and a
 *   fall-back into the previous date does not lose that date (`America/Goose_Bay`, 2010-11-07).
 * - Returns `null` when the intersection crosses more than 10,000 zone transitions (the same cap
 *   as `intervalCountZoned`).
 * - Compatibility: before 1.16.0 the count was the calendar difference of the two endpoint dates
 *   plus one. To get that number for overlapping intervals, with `start`/`end` the intersection:
 *   `diffDate(convertUnixToPlainDate(start, { timeZone }), convertUnixToPlainDate(end, { timeZone }), "days") + 1`.
 * - Returns `0` when the intersection is empty (a well-defined answer, not invalid input): when the
 *   intervals are disjoint, when they touch (e.g. `aEnd === bStart`), or when either is empty.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (epoch values that are not safe integers or numeric strings of
 *   one — fractions, empty strings and values beyond ±(2^53 − 1) are invalid — or an invalid
 *   timeZone).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates. To reproduce date-fns's number,
 *   compose `intervalIntersectionUnix` with `intervalCountUnix`:
 *   `const span = intervalIntersectionUnix(aStart, aEnd, bStart, bEnd); span ? intervalCountUnix(span.start, span.end, "day") : 0;`
 *
 * @param aStart Unix epoch value (seconds or milliseconds) — first interval start
 * @param aEnd Unix epoch value (seconds or milliseconds) — first interval end
 * @param bStart Unix epoch value (seconds or milliseconds) — second interval start
 * @param bEnd Unix epoch value (seconds or milliseconds) — second interval end
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, { timeZone: "UTC" }) // 1 (the intersection [86400000, 172800000) is 1970-01-02)
 * @example intervalOverlappingDaysUnix(0, 172800001, 86400000, 259200000, { timeZone: "UTC" }) // 2
 * @example intervalOverlappingDaysUnix(0, 86400000, 86400000, 172800000, { timeZone: "UTC" }) // 0 (touching: no shared instant)
 * @example intervalOverlappingDaysUnix(0, 86400000, 172800000, 259200000, { timeZone: "UTC" }) // 0 (disjoint)
 * @example intervalOverlappingDaysUnix(1289098830000, 1289100600000, 1289098830000, 1289100600000, { timeZone: "America/Goose_Bay" }) // 2 (the clock fell back into 2010-11-06)
 * @example diffDate(convertUnixToPlainDate(1289098830000, { timeZone: "America/Goose_Bay" }), convertUnixToPlainDate(1289100600000, { timeZone: "America/Goose_Bay" }), "days") + 1 // 0 (pre-1.16.0 count)
 * @example intervalOverlappingDaysUnix(NaN, 172800000, 86400000, 259200000, { timeZone: "UTC" }) // null
 */
export function intervalOverlappingDaysUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
  },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const a = parseUnixEpochInterval(aStart, aEnd);
  const b = parseUnixEpochInterval(bStart, bEnd);

  if (a === null || b === null) {
    return null;
  }

  const { start: a1, end: a2 } = a;
  const { start: b1, end: b2 } = b;

  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (!timeZone || epochUnit === null) {
    return null;
  }

  const overlap = halfOpenIntersection(
    { start: a1, end: a2 },
    { start: b1, end: b2 },
    (left, right) => left - right,
  );

  if (overlap === null) {
    return 0;
  }

  // An empty intersection [t, t) (an empty interval strictly inside the other) holds no instant,
  // so it holds no date.
  if (overlap.start === overlap.end) {
    return 0;
  }

  const first = unixEpochToInstant(overlap.start, epochUnit);
  const afterLast = unixEpochToInstant(overlap.end, epochUnit);

  if (first === null || afterLast === null) {
    return null;
  }

  try {
    // The last instant the half-open intersection holds is one nanosecond before its end, so the
    // closed local-date count runs to there.
    return countZonedLocalDates(
      first.toZonedDateTimeISO(timeZone),
      afterLast.toZonedDateTimeISO(timeZone).subtract({ nanoseconds: 1 }),
    );
  } catch {
    return null;
  }
}
