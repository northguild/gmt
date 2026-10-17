import {
  LEAP_SECOND_STEPS,
  NANOSECONDS_PER_SECOND,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * The leap seconds that started before a UTC instant, as a running count: TAI − UTC there, plus
 * 1 when the instant is inside an inserted second past its start. The inserted second begins at
 * 23:59:60.000 (ITU-R TF.460-6 Annex 1 §2.2), while TAI − UTC steps only at the next 00:00:00.
 *
 * @param isoString ISO 8601 instant string
 * @returns the count in seconds, or null where `taiMinusUtc` is null
 */
function leapSecondsStartedBefore(isoString: string): number | null {
  const reading = parseUtcReading(isoString);
  if (reading === null) {
    return null;
  }
  const tai = taiOfUtc(LEAP_SECOND_STEPS, reading);
  if (tai === null) {
    return null;
  }
  const taiMinusUtcSeconds =
    Number((tai - reading.epochNanoseconds) / NANOSECONDS_PER_SECOND) -
    (reading.secondSixty ? 1 : 0);
  const insideInsertedSecond =
    reading.secondSixty &&
    reading.epochNanoseconds % NANOSECONDS_PER_SECOND !== 0n;
  return taiMinusUtcSeconds + (insideInsertedSecond ? 1 : 0);
}

/**
 * Return how many leap seconds start between two UTC instants, signed.
 *
 * - From the IERS leap-second table built into GMT (Leap_Second.dat through Bulletin C 72,
 *   6 July 2026). The table is closed: after the last insertion (2016-12-31) there are none.
 * - Counts each leap second whose second starts in `[start, end)`. An inserted second starts at
 *   `…T23:59:60.000Z` (ITU-R TF.460-6 Annex 1 §2.2): from `…T23:59:60Z` to the next
 *   `…T00:00:00Z` is 1; from `…T23:59:59Z` to `…T23:59:60Z` is 0; from `…T23:59:60.5Z` to the
 *   next `…T00:00:00Z` is 0.
 * - Over whole days this is the change in TAI − UTC (`taiMinusUtc`). Inside an inserted second
 *   the two differ: TAI − UTC changes at 00:00:00, the count at 23:59:60.000.
 * - Signed: negative when `end` is before `start`.
 * - `null` when either instant is before 1972-01-01 or invalid.
 *
 * @param start ISO 8601 instant string
 * @param end ISO 8601 instant string
 * @returns the signed count, or null on invalid input or a date before 1972
 *
 * @example leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 0
 * @example leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 5
 * @example leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z") // -5
 * @example leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z") // 1
 * @example leapSecondsBetween("2016-12-31T23:59:60.5Z", "2017-01-01T00:00:00Z") // 0 — it started at 23:59:60.000
 * @example leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */
export function leapSecondsBetween(start: string, end: string): number | null {
  try {
    const before = leapSecondsStartedBefore(start);
    const after = leapSecondsStartedBefore(end);
    if (before === null || after === null) {
      return null;
    }
    return after - before;
  } catch {
    return null;
  }
}
