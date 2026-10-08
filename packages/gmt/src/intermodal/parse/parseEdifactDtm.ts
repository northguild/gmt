import { isOptionsArgument } from "../../internal";
import { readEdiDateTime } from "../../internal/ediDateTimeFields";
import type { EdiDateTime } from "../../types/edi";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse the value of a UN/EDIFACT `DTM` segment against its format code.
 *
 * A `DTM` segment carries a date, time or period as two data elements: **2380** is the value, a
 * run of digits such as `202406151430`, and **2379** (Date or time or period format code) is the
 * code that says how to read it, such as `203`. The value means nothing without the code, so this
 * function takes both. The result holds only the members the code can state. Masks and
 * descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm)
 * and from mirrors of earlier directories.
 *
 * ### Supported format codes
 * | Code | Mask | The result holds |
 * |---|---|---|
 * | `101` | `YYMMDD` | `date` |
 * | `102` | `CCYYMMDD` | `date` |
 * | `201` | `YYMMDDHHMM` | `local` |
 * | `202` | `YYMMDDHHMMSS` | `local` |
 * | `203` | `CCYYMMDDHHMM` | `local` |
 * | `204` | `CCYYMMDDHHMMSS` | `local` |
 * | `205` | `CCYYMMDDHHMMZHHMM` | `local`, `offset` and `instant` |
 * | `206` | `YYMMDDHHMMZHHMM` | `local`, `offset` and `instant` |
 * | `207` | `YYMMDDHHMMSSZHHMM` | `local`, `offset` and `instant` |
 * | `208` | `CCYYMMDDHHMMSSZHHMM` | `local`, `offset` and `instant` |
 * | `209` | `HHMMSSZHHMM` | `time` and `offset` |
 * | `301` | `YYMMDDHHMMZZZ` | `local`, `offset` and `instant`; or `local` and `zone` |
 * | `302` | `YYMMDDHHMMSSZZZ` | `local`, `offset` and `instant`; or `local` and `zone` |
 * | `303` | `CCYYMMDDHHMMZZZ` | `local`, `offset` and `instant`; or `local` and `zone` |
 * | `304` | `CCYYMMDDHHMMSSZZZ` | `local`, `offset` and `instant`; or `local` and `zone` |
 * | `401` | `HHMM` | `time` |
 * | `402` | `HHMMSS` | `time` |
 * | `404` | `HHMMSSZZZ` | `time` and `offset`, or `time` and `zone` |
 * | `406` | `ZHHMM` | `offset` |
 * | `713` | `YYMMDDHHMM-YYMMDDHHMM` | `local` and `periodEnd.local` |
 * | `717` | `YYMMDD-YYMMDD` | `date` and `periodEnd.date` |
 * | `718` | `CCYYMMDD-CCYYMMDD` | `date` and `periodEnd.date` |
 * | `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | `local` and `periodEnd.local` |
 *
 * - **Pass the unescaped element value.** `+` is the EDIFACT data element separator, so an
 *   interchange transmits `+02` as `?+02`. The syntax rules (UNTDID Part 4, Chapter 2.2, §5.1):
 *   "? immediately preceding one of the characters ' + : ? restores their normal meaning."
 *   ([archived](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm)).
 *   Remove the release character first: `"202406151430+02"` parses, `"202406151430?+02"` returns
 *   null.
 * - **Every date-time code returns `local`, the wall clock as written** (`YYYY-MM-DDTHH:MM:SS`),
 *   on its own day and never moved to UTC. A value whose offset is known adds `offset` and
 *   `instant`; a value whose zone is unresolved text adds `zone`. `parseX12DateTime` and
 *   `parseEpcisEvent` state a moment in the same three members.
 * - **A code with no offset returns `local` alone, never an instant.** `203` is a local time at
 *   a place the value does not name; reading it as UTC is the most common EDI timestamp bug.
 *   With no `instant`, `local` is ready for `resolveLocal`: pass it and the place's IANA zone to
 *   get the instant. A date-only code returns `date`, not `local`: a date names no instant in
 *   any zone.
 * - **`ZZZ` is three characters the directory does not define** ("Z = Time zone"). They have
 *   three outcomes. A signed hour from `00` to `23` (`+02`, `-05`) is that offset: UN/ECE
 *   Recommendation 7 ¶12 appends the difference from UTC "in hours and minutes, or hours only,
 *   with a leading "+" or "-" sign". The literals `UTC` and `GMT` are `+00:00`: the SMDG
 *   container-shipping guides write `UTC` in a `303` value, and Recommendation 7 ¶12 names one
 *   scale by both names, "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)".
 *   For these `301`–`304` return `local`, `offset` and `instant`. Any other three upper-case
 *   letters (`CET`, `PDT`) return `local` and the letters as `zone`, with no offset: no standard
 *   defines them, and GMT does not say what an undefined abbreviation means. `404` has no date,
 *   so it returns `time` with `offset` or with `zone`, and never an instant.
 * - **Anything else in `ZZZ` returns null** (GMT's rule). A sign or a digit that is not a valid
 *   signed hour (`+24`, `-99`, `000`) is a broken offset, not a zone name, and a space is not a
 *   zone. Lower case (`cet`) returns null because every published example is upper case, not
 *   because the syntax rules forbid it: the level A character set (UNTDID Part 4, Chapter 2.2,
 *   §5.1) is upper case only, and level B (§5.2) includes lower case. A lone `Z`
 *   (`202406151430Z` under `303`) returns null: Recommendation 7 ¶12 does write UTC as the
 *   single letter `Z`, but the mask has three characters, a variable-length element carries no
 *   trailing spaces (syntax rules §7: "leading zeroes and trailing spaces shall be suppressed"),
 *   and no guide writes it.
 * - **`205`–`209` and `406` carry a signed `HHMM` offset from UTC** (`+0200`), returned as
 *   `±HH:MM`. `-0000` is returned as `+00:00`. `205`–`208` return `local`, `offset` and
 *   `instant`. `206`–`209` are in directories D.12A and later ("Z = leading plus/minus sign,
 *   HHMM = difference to UTC in Hours and Minutes"). `209` has no date, so it returns `time` and
 *   `offset`, like `404`.
 * - **An instant can fall outside years 0000–9999.** A value within its offset of either end of
 *   the four-digit years names an instant just past it, written with a sign and a six-digit
 *   year: `999912312330-0200` under `205` is `+010000-01-01T01:30:00Z`. Its `local` stays
 *   `9999-12-31T23:30:00`.
 * - **A period is transmitted without a hyphen, and a hyphen is rejected.** Every directory read
 *   (twelve, from D.93A to D.22B) says so. From D.93A to D.01B the entries for `713` and `717`
 *   read "Format of period to be given in actual message without hyphen." and `718` reads
 *   "Format of period to be given without hyphen." From D.01C the entries for `713`, `717` and
 *   `718` read "Data is to be transmitted as consecutive characters without hyphen." `719`, in
 *   every directory that has it (it is absent from D.93A and D.96A), reads "Format of period to
 *   be given in actual message without hyphen." The hyphen in the mask is notation:
 *   `"2024061520240620"` reads and `"20240615-20240620"` returns null. A period whose end
 *   precedes its start returns null; an end equal to the start is a valid period.
 * - **A two-digit year needs `options.yearWindow`.** `101`, `201`, `202`, `206`, `207`, `301`,
 *   `302`, `713` and `717` return null without it: UN/EDIFACT does not say which century `YY`
 *   belongs to. A two-digit year is a legacy form; where a partner can send `102` or `203`, ask
 *   for it. A code with a four-digit year never reads the option.
 * - **Fields are checked, not clamped.** A month 13, an hour 24, a second 60, 31 June or
 *   29 February 2023 returns null. `time` and `local` always carry seconds (`14:30:00`), also
 *   for a mask without them.
 * - **Every other 2379 code returns null**, never a guessed format. Among them: the day-first and
 *   month-first forms `2`–`5`, `10` (`CCYYMMDDTHHMM`), `103`, the ordinal date `105`, `210`,
 *   `307`, `308`, the time spans `501`–`503`, `711`, the partial values (a year, a month or a
 *   week alone), the weekday period `720` and the quantities (`801` and up). The same null is
 *   returned for a value that does not fit its code; `isValidEdifactDtmFormat` tells the two
 *   apart. Codes match exactly: `" 102"` and `"0102"` are not `102`.
 *
 * @param value The data element 2380 value, unescaped (e.g. "202406151430")
 * @param formatQualifier The data element 2379 format code (e.g. "203")
 * @param options The century a two-digit year belongs to
 * @returns the members the code states, or null on invalid input
 *
 * @example parseEdifactDtm("202406151430", "203") // { local: "2024-06-15T14:30:00" }
 * @example parseEdifactDtm("20240615", "102") // { date: "2024-06-15" }
 * @example parseEdifactDtm("202406151430+0200", "205") // { local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }
 * @example parseEdifactDtm("202406150030+0200", "205") // { local: "2024-06-15T00:30:00", offset: "+02:00", instant: "2024-06-14T22:30:00Z" } (the instant is on the UTC day before)
 * @example parseEdifactDtm("202406151430+02", "303") // { local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }
 * @example parseEdifactDtm("202406151430UTC", "303") // { local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }
 * @example parseEdifactDtm("202406151430GMT", "303") // { local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }
 * @example parseEdifactDtm("202406151430CET", "303") // { local: "2024-06-15T14:30:00", zone: "CET" } (an undefined abbreviation: no offset)
 * @example parseEdifactDtm("202406151430+24", "303") // null (a broken offset, not a zone name)
 * @example parseEdifactDtm("202406151430Z", "303") // null (a lone Z: the mask has three zone characters)
 * @example parseEdifactDtm("202406151430cet", "303") // null (lower case: every published example is upper case)
 * @example parseEdifactDtm("20240615143045+0200", "208") // { local: "2024-06-15T14:30:45", offset: "+02:00", instant: "2024-06-15T12:30:45Z" }
 * @example parseEdifactDtm("143045+0200", "209") // { time: "14:30:45", offset: "+02:00" }
 * @example parseEdifactDtm("202406151430?+02", "303") // null (the release character is the caller's to remove)
 * @example parseEdifactDtm("143045+02", "404") // { time: "14:30:45", offset: "+02:00" }
 * @example parseEdifactDtm("+0200", "406") // { offset: "+02:00" }
 * @example parseEdifactDtm("2024061520240620", "718") // { date: "2024-06-15", periodEnd: { date: "2024-06-20" } }
 * @example parseEdifactDtm("20240615-20240620", "718") // null (a period is transmitted without a hyphen)
 * @example parseEdifactDtm("2024062020240615", "718") // null (the end precedes the start)
 * @example parseEdifactDtm("240615", "101", { yearWindow: 2000 }) // { date: "2024-06-15" }
 * @example parseEdifactDtm("690101", "101", { yearWindow: 1969 }) // { date: "1969-01-01" }
 * @example parseEdifactDtm("240615", "101") // null (a two-digit year with no window)
 * @example parseEdifactDtm("20240615", "102", { yearWindow: 1950 }) // { date: "2024-06-15" } (a four-digit year ignores the window)
 * @example parseEdifactDtm("2024", "602") // null (an unsupported code)
 * @example parseEdifactDtm("20230229", "102") // null (2023 has no 29 February)
 * @example parseEdifactDtm("not a date", "203") // null
 */
export function parseEdifactDtm(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): EdiDateTime | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }
    return readEdiDateTime("edifact", formatQualifier, value, options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
