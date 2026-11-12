/*
 * A NOTAM item B) or C) value: the ten-digit date-time group `YYMMDDHHMM`, and in item C) also
 * the same group followed by `EST`, or `PERM`. Private: a group is a moment only once its century
 * is known, so the public check is `isValidNotamValidity(value, options)`, never a pattern.
 *
 * Sources:
 * - ICAO PANS-AIM (Doc 10066, 1st ed. 2018), Appendix 3, "Instructions for the completion of the
 *   NOTAM Format". §5 (item B): "For date-time group use a ten-figure group, giving year, month,
 *   day, hours and minutes in UTC"; "The start of a day shall be indicated by '0000'". §6
 *   (item C): "a date-time group (a ten-figure group giving year, month, day, hours and minutes
 *   in UTC) indicating duration of information shall be used unless the information is of a
 *   permanent nature in which case the abbreviation 'PERM' is inserted instead"; "The end of a
 *   day shall be indicated by '2359' (i.e. do not use '2400')"; "If the information on timing is
 *   uncertain, the approximate duration shall be indicated using a date-time group followed by
 *   the abbreviation 'EST'".
 * - EUROCONTROL-GUID-121, _OPADD_ Ed. 4.1 (07/12/2020), the multinational peer, for what ICAO
 *   does not say. §2.3.16 (item B): "Insertion of 'WIE' or 'WEF' is not permitted". §2.3.17
 *   (item C): "There shall be no space between the ten digits and 'EST'"; "Insertions of 'UFN'
 *   or 'APRX DUR' are not permitted".
 *
 * GMT rules:
 * - The reader checks the shape, not the date: month `13` and hour `24` come back as fields, and
 *   Temporal rejects them later. Nothing is corrected: OPADD Ch. 3 (p. C-95) gives the `2400`, `WIE`
 *   and `UFN` fixes to a NOTAM Processing Unit, not to a reader. `0001` is a rule for writers
 *   (PANS-AIM App 3 §5 starts a day at `0000`; OPADD §2.3.16: "do not use '0001'"); GMT reads
 *   `0001` as 00:01.
 * - `PERM` and `EST` are upper case, with no space; no case conversion. Digits are ASCII only:
 *   the grammar writes `[0-9]`, not `\d`.
 * - `EST` and `PERM` belong to item C) only (PANS-AIM App 3 §5 gives item B) the ten-figure group
 *   alone; §6 adds them to item C)); this reader does not know which item it is reading, so the
 *   caller treats them in item B) as malformed.
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
