import {
  formatUtcReading,
  LEAP_SECOND_STEPS,
  nextStepIndex,
  parseUtcReading,
  stepReading,
  taiOfUtc,
} from "../../internal";

/**
 * Return the first leap second after a UTC instant, as its UTC label `…T23:59:60Z`.
 *
 * - From the IERS leap-second table built into GMT (Leap_Second.dat through Bulletin C 72,
 *   6 July 2026).
 * - `""` for every instant from 2016-12-31T23:59:60Z on: there are no more. The table is closed
 *   (continuous UTC from 20 May 2027, CGPM 2026).
 * - `""` also on invalid input or a date before 1972; check with `isValidInstant` to tell them apart.
 *
 * @param isoString ISO 8601 instant string
 * @returns the next leap second's UTC label, or "" when there is none or on invalid input
 *
 * @example nextLeapSecond("2016-01-01T00:00:00Z") // "2016-12-31T23:59:60Z"
 * @example nextLeapSecond("1999-08-22T00:00:00Z") // "2005-12-31T23:59:60Z"
 * @example nextLeapSecond("2016-12-31T23:59:60Z") // ""
 * @example nextLeapSecond("2024-01-01T00:00:00Z") // ""
 */
export function nextLeapSecond(isoString: string): string {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null || taiOfUtc(LEAP_SECOND_STEPS, reading) === null) {
      return "";
    }
    const index = nextStepIndex(LEAP_SECOND_STEPS, reading);
    return index === -1
      ? ""
      : formatUtcReading(stepReading(LEAP_SECOND_STEPS, index));
  } catch {
    return "";
  }
}
