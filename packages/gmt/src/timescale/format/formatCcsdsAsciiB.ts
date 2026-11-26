import type { FractionalDigit } from "../../types";
import {
  ccsdsCodeBText,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * Write an instant as a CCSDS ASCII Time Code B string (`YYYY-DDDThh:mm:ss.d…dZ`, day of year).
 *
 * - CCSDS 301.0-B-4 §3.5.1.2. The instant is converted to UTC, and `DDD` is the UTC day of the
 *   year, 001 to 365, or 366 in a leap year. The `Z` is always written.
 * - `fractionalSecondDigits` works as in Temporal's `toString`: omitted or `"auto"` writes the
 *   shortest fraction that keeps every nanosecond, `0` writes no fraction and no period, and `1`
 *   to `9` write exactly that many digits. Extra digits are cut, never rounded, so the result
 *   never moves into the next second, day or year.
 * - An inserted leap second is written as `…T23:59:60Z` on its own day. A second of 60 that is not
 *   one of the 27 inserted leap seconds (for example `2016-12-31T23:58:60Z`) returns "".
 * - "" for a date-time with no offset, a UTC year outside 0001 to 9999, a
 *   `fractionalSecondDigits` Temporal refuses (`10`, `-1`, `null`, `"3"`), and invalid input.
 *
 * @param isoString ISO 8601 instant string, with `Z` or an offset
 * @param fractionalSecondDigits `"auto"` (default) or 0 to 9
 * @returns the Code B text, or "" on invalid input
 *
 * @example formatCcsdsAsciiB("1988-01-18T17:20:43.123456Z") // "1988-018T17:20:43.123456Z" — CCSDS's own example
 * @example formatCcsdsAsciiB("2024-12-31T23:59:59Z") // "2024-366T23:59:59Z" — day 366
 * @example formatCcsdsAsciiB("2024-01-01T01:00:00+02:00") // "2023-365T23:00:00Z" — the UTC day
 * @example formatCcsdsAsciiB("2016-12-31T23:59:60Z") // "2016-366T23:59:60Z" — the inserted second
 * @example formatCcsdsAsciiB("2024-06-15T10:30:00") // "" — no offset, so no instant
 */
export function formatCcsdsAsciiB(
  isoString: string,
  fractionalSecondDigits?: FractionalDigit,
): string {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return "";
    }
    // Only for a 60: taiOfUtc is null before 1972 for an ordinary second too, and Code B runs from 0001.
    if (reading.secondSixty && taiOfUtc(LEAP_SECOND_STEPS, reading) === null) {
      return "";
    }
    return ccsdsCodeBText(reading, fractionalSecondDigits);
  } catch {
    return "";
  }
}
