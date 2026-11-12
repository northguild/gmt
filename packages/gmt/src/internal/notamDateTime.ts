/*
 * A NOTAM item B) or C) value: the ten-digit date-time group `YYMMDDHHMM`, and in item C) also
 * the same group followed by `EST`, or `PERM`. Private: a group is a moment only once its century
 * is known, so the public check is `isValidNotamValidity(value, options)`, never a pattern.
 *
 * Sources:
 * - EUROCONTROL-GUID-121, _OPADD_ Ed. 4.1 (07/12/2020), §2.3.16 (item B): "A ten-digit date-time
 *   group giving the year, month, day, hour and minutes at which the NOTAM comes into force";
 *   "Insertion of 'WIE' or 'WEF' is not permitted".
 * - OPADD 4.1 §2.3.17 (item C): "a ten-digit date-time group giving the year, month, day, hour and
 *   minute at which the NOTAM ceases to be in force"; "the date-time group shall be followed by
 *   'EST' (estimate). There shall be no space between the ten digits and 'EST'"; "the
 *   abbreviation 'PERM' shall be used instead of a date-time group"; "Insertions of 'UFN' or
 *   'APRX DUR' are not permitted".
 * - OPADD 4.1 §2.2: "All published times shall be in UTC".
 * - ICAO PANS-AIM (Doc 10066) Appendix 6 and Annex 15 were not reached.
 *
 * GMT rules:
 * - The reader checks the shape, not the date: month `13` and hour `24` come back as fields, and
 *   Temporal rejects them later. Nothing is corrected: OPADD Ch. 3 (p. C-95) gives the `2400`, `WIE`
 *   and `UFN` fixes to a NOTAM Processing Unit, not to a reader. `0001` is a §2.3.16 rule for
 *   writers ("do not use '0001'"); GMT reads `0001` as 00:01.
 * - `PERM` and `EST` are upper case, with no space; no case conversion. Digits are ASCII only:
 *   the grammar writes `[0-9]`, not `\d`.
 * - `EST` and `PERM` belong to item C) only (§2.3.16, §2.3.17); this reader does not know which
 *   item it is reading, so the caller treats them in item B) as malformed.
 */

/** The fields of an item B) or C) value: `PERM`, or a `YYMMDDHHMM` group with its `EST` flag. */
export type NotamDateTimeFields =
  | { kind: "permanent" }
  | {
      kind: "dateTime";
      yy: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      estimated: boolean;
    };

// No `i`, `m` or `u` flag: `$` then fails before a trailing newline. Plain literals, so linear time.
const NOTAM_DATE_TIME =
  /^(?:PERM|([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})(EST)?)$/;

/** Read an item B) or C) value, or null when the shape does not match. */
export function readNotamDateTimeFields(
  value: string,
): NotamDateTimeFields | null {
  const match = NOTAM_DATE_TIME.exec(value);
  if (match === null) return null;
  const [, yy, month, day, hour, minute, est] = match;
  if (yy === undefined) return { kind: "permanent" };
  return {
    kind: "dateTime",
    yy: Number(yy),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    estimated: est !== undefined,
  };
}
