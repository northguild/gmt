import {
  formatTai64nLabel,
  LAST_FOUR_DIGIT_UTC_NANOSECONDS,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * Convert a UTC instant to its TAI64N label in the daemontools text form, `@` and 24 lowercase
 * hex digits.
 *
 * - The label is TAI: 8 bytes of 2^62 + TAI seconds since 1970-01-01T00:00:00 TAI, then 4 bytes
 *   of nanoseconds (Bernstein, TAI64 § TAI64N), printed as daemontools `tai64n` prints it.
 * - TAI = UTC + (TAI − UTC), from the IERS leap-second table built into GMT (Leap_Second.dat
 *   through Bulletin C 72, 6 July 2026). The table is closed: the CGPM decided in 2026 that UTC
 *   becomes continuous on 20 May 2027, so after the last insertion (2016-12-31) TAI − UTC stays
 *   37 s.
 * - An inserted second has its own label: `2016-12-31T23:59:60Z` is `@40000000586846a400000000`.
 *   A second 60 on any other day returns "".
 * - Every nanosecond Temporal holds is kept; the label never has attoseconds.
 * - Accepts any offset or bracketed zone `toTAI` accepts.
 * - daemontools assumes a clock at TAI − 10 s (`tai_unix` adds 2^62 + 10 to Unix seconds): on a POSIX
 *   UTC clock its label is (TAI − UTC) − 10 = 27 s below this one from 2017 on, and `fromTai64n` reads it 27 s early.
 * - "" before 1972-01-01, after 9999-12-31T23:59:59.999999999Z, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TAI64N label, or "" on invalid input, a date before 1972, or after year 9999
 *
 * @example toTai64n("1992-06-02T08:06:43Z") // "@400000002a2b2c2d00000000" — Bernstein's example
 * @example toTai64n("1999-08-24T04:03:43.7874925Z") // "@4000000037c219bf2ef02e94" — daemontools' example
 * @example toTai64n("2026-01-01T00:00:00Z") // "@400000006955b92500000000"
 * @example toTai64n("2016-12-31T23:59:60Z") // "@40000000586846a400000000" — the inserted second
 * @example toTai64n("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTai64n("1971-12-31T00:00:00Z") // ""
 */
export function toTai64n(isoString: string): string {
  try {
    const reading = parseUtcReading(isoString);
    if (
      reading === null ||
      reading.epochNanoseconds > LAST_FOUR_DIGIT_UTC_NANOSECONDS
    ) {
      return "";
    }
    const tai = taiOfUtc(LEAP_SECOND_STEPS, reading);
    return tai === null ? "" : formatTai64nLabel(tai);
  } catch {
    return "";
  }
}
