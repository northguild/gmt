/**
 * The UN/EDIFACT data element 2379 (Date or time or period format code) values GMT reads and
 * writes: 23 codes. Masks and descriptions are the UNTDID directory's. Twelve directories were
 * read: UNECE's own
 * [D.21B](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm)
 * and
 * [D.22B](http://web.archive.org/web/20260311101223/https://service.unece.org/trade/untdid/d22b/tred/tred2379.htm)
 * pages, archived, and mirrors of D.93A, D.96A, D.01B, D.01C, D.03A, D.03B, D.04B, D.11B, D.12A
 * and D.13B. No mask of a code GMT reads changed across them.
 *
 * - `101` `YYMMDD`, `102` `CCYYMMDD`: a calendar date.
 * - `201` `YYMMDDHHMM`, `202` `YYMMDDHHMMSS`, `203` `CCYYMMDDHHMM`, `204` `CCYYMMDDHHMMSS`: a
 *   date and time with no offset.
 * - `205` `CCYYMMDDHHMMZHHMM`, `206` `YYMMDDHHMMZHHMM`, `207` `YYMMDDHHMMSSZHHMM`, `208`
 *   `CCYYMMDDHHMMSSZHHMM`: a date and time with a `±HHMM` UTC offset. `206`–`209` are in
 *   directories D.12A and later.
 * - `209` `HHMMSSZHHMM`: a time with a `±HHMM` UTC offset.
 * - `301` `YYMMDDHHMMZZZ`, `302` `YYMMDDHHMMSSZZZ`, `303` `CCYYMMDDHHMMZZZ`, `304`
 *   `CCYYMMDDHHMMSSZZZ`: a date and time with a three-character zone.
 * - `401` `HHMM`, `402` `HHMMSS`: a time; `404` `HHMMSSZZZ`: a time with a zone.
 * - `406` `ZHHMM`: a UTC offset alone.
 * - `713` `YYMMDDHHMM-YYMMDDHHMM`, `717` `YYMMDD-YYMMDD`, `718` `CCYYMMDD-CCYYMMDD`, `719`
 *   `CCYYMMDDHHMM-CCYYMMDDHHMM`: a period, transmitted without the hyphen.
 *
 * Every other 2379 code returns the sentinel. Among them: the day-first and month-first forms
 * `2`–`5`, `10` (`CCYYMMDDTHHMM`), the week date `103`, the ordinal date `105`, the time period
 * `210`, `307` (milliseconds), the zoned period `308`, the time spans `501`–`503`, `711`, the
 * partial values (a century, a year, a month, a week or a day of month alone), the weekday period
 * `720` and the quantities (`801` and up).
 *
 * Narrow a candidate with `isValidEdifactDtmFormat`.
 */
export type EdifactDtmFormat =
  | "101"
  | "102"
  | "201"
  | "202"
  | "203"
  | "204"
  | "205"
  | "206"
  | "207"
  | "208"
  | "209"
  | "301"
  | "302"
  | "303"
  | "304"
  | "401"
  | "402"
  | "404"
  | "406"
  | "713"
  | "717"
  | "718"
  | "719";

/**
 * The X12 data element 1250 (Date Time Period Format Qualifier) values GMT reads and writes: 20
 * codes, and `UN`. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached. The 42-code list is the same in release 008010.
 *
 * - `D8` `CCYYMMDD`, `D6` `YYMMDD`, `DB` `MMDDCCYY`, `TT` `MMDDYY`: a calendar date.
 * - `DT` `CCYYMMDDHHMM`, `TR` `DDMMYYHHMM`, `RTS` `CCYYMMDDHHMMSS` (one date-time despite the
 *   `R`): a date and time with no offset.
 * - `TM` `HHMM`, `TS` `HHMMSS`: a time.
 * - `RD8` `CCYYMMDD-CCYYMMDD`, `RD6` `YYMMDD-YYMMDD`, `RD` `MMDDCCYY-MMDDCCYY`, `RDT`
 *   `CCYYMMDDHHMM-CCYYMMDDHHMM`, `DTS` `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` (a range despite having
 *   no `R`), `DDT` `CCYYMMDD-CCYYMMDDHHMM`, `DTD` `CCYYMMDDHHMM-CCYYMMDD`, `RTM` `HHMM-HHMM`: a
 *   range, transmitted with its hyphen.
 * - `TU` `YYDDD`: a date, written as a two-digit year and a day of the year.
 * - `TC` `DDD`: a day of the year with no year; `EH` `YDDD`: a day of the year with the last
 *   digit of the year. Neither names a year, so neither is resolved to a date.
 * - `UN` (Unstructured) is here so a validator can name it, and always returns the sentinel: GMT
 *   never guesses a format.
 *
 * The other 21 codes of the element return the sentinel: `CC`, `CD`, `CM`, `CQ`, `CY`, `DA`,
 * `DD`, `KA`, `MCY`, `MD`, `MM`, `RD2`, `RD4`, `RD5`, `RDM`, `RMD`, `RMY`, `TQ`, `YM`, `YMM` and
 * `YY`. `TS`, `TT`, `CD` and `MD` are also codes of data element 623 (`X12TimeCode`), where they
 * mean something unrelated.
 *
 * Narrow a candidate with `isValidX12DateTimePeriodFormat`.
 */
export type X12DateTimePeriodFormat =
  | "D6"
  | "D8"
  | "DB"
  | "TT"
  | "DT"
  | "TR"
  | "RTS"
  | "TM"
  | "TS"
  | "RD6"
  | "RD8"
  | "RD"
  | "RDT"
  | "DTS"
  | "DDT"
  | "DTD"
  | "RTM"
  | "TC"
  | "TU"
  | "EH"
  | "UN";

/**
 * The 56 X12 data element 623 (Time Code) values, release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51 of them: `25`–`29`
 * were added in release 006010 and are not valid in an 004010 or 005010 interchange. The type
 * names no release, so it is the superset.
 *
 * - `01`–`12`: UTC+1 through UTC+12 ("Equivalent to ISO P01" … `P12`).
 * - `13`–`24`: UTC−12 through UTC−1, in **descending** order (`M12` … `M01`): `13` is UTC−12 and
 *   `24` is UTC−1.
 * - `25`–`29`: the half-hour offsets `M2:30`, `M3:30`, `P5:30`, `P9:30`, `P10:30`.
 * - `UT` ("Universal Time Coordinate") and `GM` ("Greenwich Mean Time"): UTC.
 * - `AD`/`AS`/`AT` Alaska, `CD`/`CS`/`CT` Central, `ED`/`ES`/`ET` Eastern, `HD`/`HS`/`HT`
 *   Hawaii-Aleutian, `MD`/`MS`/`MT` Mountain, `ND`/`NS`/`NT` Newfoundland, `PD`/`PS`/`PT`
 *   Pacific, `TD`/`TS`/`TT` Atlantic: a named zone, daylight (`D`), standard (`S`) or unstated
 *   (`T`). X12 states no offset for these.
 * - `LT`: local time of the event, whose place is elsewhere in the message.
 *
 * `TS`, `TT`, `CD` and `MD` are also codes of data element 1250 (`X12DateTimePeriodFormat`),
 * where they mean something unrelated. Narrow a candidate with `isValidX12TimeCode`.
 */
export type X12TimeCode =
  // fallow-ignore-next-line code-duplication -- the 56 DE 623 codes in type position; `X12_TIME_CODES` in internal/ediGrammar.ts is the same enumeration as a runtime list
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "AD"
  | "AS"
  | "AT"
  | "CD"
  | "CS"
  | "CT"
  | "ED"
  | "ES"
  | "ET"
  | "GM"
  | "HD"
  | "HS"
  | "HT"
  | "LT"
  | "MD"
  | "MS"
  | "MT"
  | "ND"
  | "NS"
  | "NT"
  | "PD"
  | "PS"
  | "PT"
  | "TD"
  | "TS"
  | "TT"
  | "UT";

/**
 * The end of an EDI period or range, read from the second half of the value. Each code fills only
 * the members it can state. No period code GMT reads carries an offset, so an end is a date, a
 * time or a local date-time, never an instant.
 */
export interface EdiPeriodEnd {
  /** The end date, `YYYY-MM-DD`, for a date period (`718`, `RD8`, …). Absent for a time-only range. */
  date?: string;
  /**
   * The end time, `HH:MM:SS`, for a time range (`RTM`). Absent when the end carries a date. It
   * can be earlier than the start's `time`: an `RTM` range carries no date, so `2200-0600` is a
   * window that crosses midnight.
   */
  time?: string;
  /**
   * The end date-time, `YYYY-MM-DDTHH:MM:SS`, for a date-time period (`713`, `719`, `RDT`,
   * `DTS`, `DDT`). Absent when the end is a date or a time alone.
   */
  local?: string;
}

/**
 * What an EDI date/time value states, read against its format code. Each code fills only the
 * members it can state, so a caller can tell a local time whose zone is unknown from an instant
 * whose offset was transmitted: a `203` value yields `local` and nothing else; a `205` value
 * yields `local`, `offset` and `instant`. The shape is shared by `parseEdifactDtm` and
 * `parseX12DateTimePeriod`.
 */
export interface EdiDateTime {
  /**
   * `YYYY-MM-DD`, for a date-only code (`102`, `101`, `D8`, `DB`, …), for `TU`, and for the start
   * of a date period.
   */
  date?: string;
  /**
   * `HH:MM:SS`, for a time-only code (`401`, `402`, `404`, `209`, `TM`, `TS`) and the start of a
   * time range. Seconds are always written, `00` for a mask without them.
   */
  time?: string;
  /**
   * `YYYY-MM-DDTHH:MM:SS`, for every date-time code (`201`–`208`, `301`–`304`, `DT`, `TR`,
   * `RTS`) and the start of a date-time period: the wall clock as written, never moved to UTC.
   * Seconds are always written, `00` for a mask without them. With no `instant` (a `203` or
   * `DT` value, a `3xx` value whose zone is a name such as `CET`), `local` is ready for
   * `resolveLocal` once the caller knows the zone. A date-only code returns `date`, not `local`:
   * a date names no instant.
   */
  local?: string;
  /**
   * The UTC instant ending in `Z`, when the code carries a date, a time and a resolvable offset:
   * `205`–`208`, or `301`–`304` whose zone is `±HH`, `UTC` or `GMT`. It is `local` read at
   * `offset`, and stands beside both, so its UTC date can be the day before or after `local`'s.
   * Absent otherwise; a `209` or `404` value has no date, so it yields `time` and `offset` and
   * no instant. A value within its offset of either end of years 0000–9999 yields an instant
   * outside them, written with a sign and a six-digit year.
   */
  instant?: string;
  /**
   * The offset in force where the event happened, `±HH:MM`. Present with `local` and `instant`
   * for a date-time whose offset is known; beside `time` for a `209` value and for a `404` value
   * whose zone is `±HH`, `UTC` or `GMT`; alone for `406`, whose value is the offset itself.
   */
  offset?: string;
  /**
   * The three upper-case letters of a `301`–`304` or `404` zone that are neither `UTC` nor `GMT`
   * (`CET`, `PDT`), as transmitted. No UN/EDIFACT text defines them, so GMT returns them unread
   * and asserts nothing about them; `local` (or `time` for `404`) holds the wall clock.
   */
  zone?: string;
  /**
   * The day of the year, 1–366, for `TC`, `TU` and `EH`. For `TU` it is checked against the year
   * and stands beside the `date` it names; `TC` and `EH` name no year, so they have no `date`.
   */
  dayOfYear?: number;
  /** The last digit of the year, 0–9, for `EH` only. A single digit names no year, so nothing is resolved from it. */
  yearDigit?: number;
  /** The end of a period or range code (`713`, `717`, `718`, `719`, `RD8`, `RDT`, `RTM`, …). Absent for a single value. */
  periodEnd?: EdiPeriodEnd;
}
