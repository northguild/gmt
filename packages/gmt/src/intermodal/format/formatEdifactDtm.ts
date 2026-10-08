import { isOptionsArgument } from "../../internal";
import { writeEdiDateTime } from "../../internal/ediDateTimeWriter";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Write an ISO 8601 value as a UN/EDIFACT `DTM` value (data element 2380) in a format code (data
 * element 2379). The inverse of `parseEdifactDtm`: what one writes, the other reads back.
 *
 * `value` is one ISO 8601 string, and the code fixes which kind:
 *
 * ### The value each code takes
 * | Code | Mask | `value` |
 * |---|---|---|
 * | `101`, `102` | `YYMMDD`, `CCYYMMDD` | A date, `YYYY-MM-DD` |
 * | `201`–`204` | `[CC]YYMMDDHHMM[SS]` | A local date-time, `YYYY-MM-DDTHH:MM[:SS]` |
 * | `205` | `CCYYMMDDHHMMZHHMM` | A date-time with an offset or `Z`, `YYYY-MM-DDTHH:MM[:SS]±HH:MM` |
 * | `206`–`208` | `[CC]YYMMDDHHMM[SS]ZHHMM` | A date-time with an offset or `Z` |
 * | `209` | `HHMMSSZHHMM` | A time with an offset or `Z`, `HH:MM[:SS]±HH:MM` |
 * | `301`–`304` | `[CC]YYMMDDHHMM[SS]ZZZ` | A date-time with an offset or `Z` |
 * | `401`, `402` | `HHMM`, `HHMMSS` | A time, `HH:MM[:SS]` |
 * | `404` | `HHMMSSZZZ` | A time with an offset or `Z`, `HH:MM[:SS]±HH:MM` |
 * | `406` | `ZHHMM` | An offset, `±HH:MM` |
 * | `713`, `717`–`719` | A period | An interval of two dates or two local date-times, `<start>/<end>` |
 *
 * - **Takes what `parseEdifactDtm` returns.** A `date`, a `local` with no offset and a `406`
 *   `offset` are passed as they are; a date-time with an offset is `local` followed by `offset`
 *   (`fromOffsetInstant` builds the same string from `instant` and `offset`); a `209` or `404`
 *   result is `time` followed by `offset`; a period is the start, a solidus and the end.
 * - **The output is the element value, not segment text.** `+` is the EDIFACT data element
 *   separator, so a value that holds one (`202406151430+02`) must be released when it is placed
 *   in a segment: write `?+`. The syntax rules (UNTDID Part 4, Chapter 2.2, §5.1): "?
 *   immediately preceding one of the characters ' + : ? restores their normal meaning."
 *   ([archived](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm)).
 *   The function does not add the release character, as `parseEdifactDtm` does not remove it.
 * - **The digits are the value's own wall clock.** A date-time with an offset is written on the
 *   clock at that offset, never on the UTC clock: `2024-01-01T00:30:00+02:00` under `303` is
 *   `202401010030+02`.
 * - **A `ZZZ` zone is always written `±HH`**, the hours-only form of UN/ECE Recommendation 7 ¶12.
 *   `Z` and `+00:00` are written `+00`. The formatter never writes `UTC`, `GMT` or an
 *   abbreviation, so a value parsed as `local` and `zone` text (`CET`) has no offset to write:
 *   resolve it with `resolveLocal` first.
 * - **A period is written without a hyphen.** Every UNTDID directory read (twelve, from D.93A
 *   to D.22B) says so: from D.01C the entries for `713`, `717` and `718` read "Data is to be
 *   transmitted as consecutive characters without hyphen.", and `719`, in every directory that
 *   has it, reads "Format of period to be given in actual message without hyphen."
 *   `2024-06-15/2024-06-20` under `718` is `2024061520240620`. The only `-` the function ever
 *   writes is the sign of a negative offset.
 * - **The mask must hold the value exactly; nothing is rounded.** Seconds of `:00` may be left
 *   out or dropped for a minute code (`14:30:00` under `401` is `1430`), and a fraction of zero
 *   is no fraction. Non-zero seconds under a minute code, any non-zero fraction of a second,
 *   offset minutes under a `ZZZ` code (`+05:30`) and offset seconds under any code return `""`.
 * - **The kind must match the code.** A date-time given to a date code, a date given to a
 *   date-time code, an offset or `Z` given to a code with no offset, and a local date-time given
 *   to a code with one all return `""`. A period takes two explicit ends of the same kind, never
 *   a duration.
 * - **A year outside 0000–9999 returns `""`**: `CCYY` holds four digits and no sign.
 * - **A two-digit-year code needs `options.yearWindow`** (`101`, `201`, `202`, `206`, `207`,
 *   `301`, `302`, `713`, `717`). It returns `""` without one, and for a year outside the window,
 *   so reading the value back with the same window never changes the century. The year held to
 *   the window is the local one. A code with a four-digit year never reads the option.
 * - Each part is validated by `isValidDate`, `isValidDateTime`, `isValidTime` or
 *   `toOffsetInstant` and reads RFC 9557 annotations as they do: a bracketed zone on a date-time
 *   with an offset must agree with it, and a `209` or `404` value takes none.
 * - Returns `""` for an unsupported code, a reversed period, a non-string argument, or an
 *   `options` argument that is not an object.
 *
 * @param value One ISO 8601 string of the kind the code takes (e.g. "2024-06-15T14:30:00")
 * @param formatQualifier The data element 2379 format code (e.g. "203")
 * @param options The century window a two-digit year must fall in
 * @returns the data element 2380 value, unescaped, or "" on invalid input
 *
 * @example formatEdifactDtm("2024-06-15T14:30:00", "203") // "202406151430"
 * @example formatEdifactDtm("2024-06-15", "102") // "20240615"
 * @example formatEdifactDtm("2024-06-15T14:30:00+02:00", "205") // "202406151430+0200"
 * @example formatEdifactDtm("2024-06-15T14:30:00+02:00", "303") // "202406151430+02"
 * @example formatEdifactDtm("2024-06-15T14:30:00Z", "303") // "202406151430+00" (never "UTC")
 * @example formatEdifactDtm("2024-06-15T14:30:00+05:30", "303") // "" (ZZZ holds whole hours; use 205)
 * @example formatEdifactDtm("2024-06-15T14:30:00", "303") // "" (a local time has no offset to write)
 * @example formatEdifactDtm("14:30:00", "401") // "1430" (seconds of :00 are dropped)
 * @example formatEdifactDtm("14:30:45", "401") // "" (the mask has no seconds; use 402)
 * @example formatEdifactDtm("14:30:45+02:00", "404") // "143045+02"
 * @example formatEdifactDtm("2024-06-15T14:30:45+05:30", "208") // "20240615143045+0530"
 * @example formatEdifactDtm("14:30:45+02:00", "209") // "143045+0200"
 * @example formatEdifactDtm("+02:00", "406") // "+0200"
 * @example formatEdifactDtm("2024-06-15/2024-06-20", "718") // "2024061520240620" (no hyphen)
 * @example formatEdifactDtm("2024-06-20/2024-06-15", "718") // "" (the end precedes the start)
 * @example formatEdifactDtm("2024-06-15", "101", { yearWindow: 2000 }) // "240615"
 * @example formatEdifactDtm("1969-01-01", "101", { yearWindow: 2000 }) // "" (1969 is outside 2000–2099)
 * @example formatEdifactDtm("2024-06-15", "101") // "" (a two-digit year with no window)
 * @example formatEdifactDtm("2024-06-15", "102", { yearWindow: 1950 }) // "20240615" (a four-digit year ignores the window)
 * @example formatEdifactDtm("2024-06-15T14:30:00", "102") // "" (a date-time given to a date code)
 * @example formatEdifactDtm("2024-06-15", "602") // "" (an unsupported code)
 * @example formatEdifactDtm("not a date", "203") // ""
 */
export function formatEdifactDtm(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }
    return writeEdiDateTime("edifact", formatQualifier, value, options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
