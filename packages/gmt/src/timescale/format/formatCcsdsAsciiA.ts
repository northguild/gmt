import type { FractionalDigit } from "../../types";
import {
  ccsdsCodeAText,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * Write an instant as a CCSDS ASCII Time Code A string (`YYYY-MM-DDThh:mm:ss.d…dZ`).
 *
 * - CCSDS 301.0-B-4 §3.5.1.1. The instant is converted to UTC; the `Z` is always written.
 * - `fractionalSecondDigits` works as in Temporal's `toString`: omitted or `"auto"` writes the
 *   shortest fraction that keeps every nanosecond, `0` writes no fraction and no period, and `1`
 *   to `9` write exactly that many digits. Extra digits are cut, never rounded, so the result
 *   never moves into the next second, day or year.
 * - An inserted leap second is written as `…T23:59:60Z`. A second of 60 that is not one
 *   of the 27 inserted leap seconds (for example `2016-12-31T23:58:60Z`) returns "".
 * - "" for a date-time with no offset, a UTC year outside 0001 to 9999, a
 *   `fractionalSecondDigits` Temporal refuses (`10`, `-1`, `null`, `"3"`), and invalid input.
 *
 * @param isoString ISO 8601 instant string, with `Z` or an offset
 * @param fractionalSecondDigits `"auto"` (default) or 0 to 9
 * @returns the Code A text, or "" on invalid input
 *
 * @example formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00", 6) // "2024-06-15T10:30:00.123456Z"
 * @example formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00") // "2024-06-15T10:30:00.123456789Z"
 * @example formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00", 0) // "2024-06-15T10:30:00Z"
 * @example formatCcsdsAsciiA("2016-12-31T23:59:60.5Z", 3) // "2016-12-31T23:59:60.500Z" — the inserted second
 * @example formatCcsdsAsciiA("2024-06-15T10:30:00") // "" — no offset, so no instant
 */
export function formatCcsdsAsciiA(
  isoString: string,
  fractionalSecondDigits?: FractionalDigit,
): string {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return "";
    }
    // Only for a 60: taiOfUtc is null before 1972 for an ordinary second too, and Code A runs from 0001.
    if (reading.secondSixty && taiOfUtc(LEAP_SECOND_STEPS, reading) === null) {
      return "";
    }
    return ccsdsCodeAText(reading, fractionalSecondDigits);
  } catch {
    return "";
  }
}
