import {
  formatUtcReading,
  LEAP_SECOND_STEPS,
  parseTai64Label,
  utcOfTai,
} from "../../internal";

/**
 * Convert a TAI64, TAI64N or TAI64NA label in hex text to a UTC instant string.
 *
 * - Reads 16 (TAI64), 24 (TAI64N) or 32 (TAI64NA) hex digits, with or without the leading `@`
 *   daemontools writes, either case. The whole string must be the label: no log text, no spaces.
 * - The label is TAI: 2^62 + the TAI seconds since 1970-01-01T00:00:00 TAI (Bernstein, TAI64 §
 *   TAI64 labels), not Unix seconds. Reading it as Unix time is wrong by TAI − UTC: 26 s in
 *   1992, 37 s today.
 * - UTC = TAI − (TAI − UTC), from the IERS leap-second table built into GMT (Leap_Second.dat
 *   through Bulletin C 72, 6 July 2026). The table is closed: after the last insertion
 *   (2016-12-31) TAI − UTC stays 37 s.
 * - During an inserted second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only the
 *   `timescale/`, `gnss/` and `finance/` functions read that string back; other GMT functions
 *   reject a second of 60.
 * - Nanoseconds are kept exactly. TAI64NA attoseconds are checked (0 to 999999999) and dropped:
 *   truncated, never rounded.
 * - daemontools `tai64n` assumes the system clock counts TAI seconds since 1970-01-01 00:00:10 TAI
 *   (https://cr.yp.to/daemontools/tai64n.html): on a POSIX UTC clock its label is
 *   (TAI − UTC) − 10 = 27 s below the true label from 2017 on, and `fromTai64n` reads it 27 s early.
 * - "" for a label before 1972-01-01T00:00:10 TAI, a result past year 9999, a reserved label
 *   (2^63 and up), a counter above 999999999, and on invalid input.
 *
 * @param label TAI64, TAI64N or TAI64NA hex text
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input, a label before
 * 1972-01-01T00:00:10 TAI, a result past year 9999, a reserved label (2^63 and up), or a counter
 * above 999999999
 *
 * @example fromTai64n("@400000002a2b2c2d00000000") // "1992-06-02T08:06:43Z" — Bernstein's example
 * @example fromTai64n("@4000000037c219bf2ef02e94") // "1999-08-24T04:03:43.7874925Z" — daemontools' example
 * @example fromTai64n("400000002a2b2c2d") // "1992-06-02T08:06:43Z" — TAI64
 * @example fromTai64n("@4000000037c219bf2ef02e943b9ac9ff") // "1999-08-24T04:03:43.7874925Z" — attoseconds dropped
 * @example fromTai64n("@40000000586846a400000000") // "2016-12-31T23:59:60Z" — the inserted second
 * @example fromTai64n("@4000000000000000") // "" — 1970 TAI, before 1972
 * @example fromTai64n("@400000002a2b2c2d0000000") // "" — 23 hex digits
 */
export function fromTai64n(label: string): string {
  try {
    const tai = parseTai64Label(label);
    if (tai === null) {
      return "";
    }
    const reading = utcOfTai(LEAP_SECOND_STEPS, tai);
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
