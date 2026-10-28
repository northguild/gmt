import { Temporal } from "../../internal/temporal";
import {
  isOptionsArgument,
  parseValueWithPattern,
  YEAR_MONTH_PATTERN_FIELDS,
} from "../../internal";
import { yearMonthString } from "../../internal/yearMonth";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse a year-month string against a caller-supplied token pattern (e.g. `"MM/yyyy"`,
 * `"MMMM yyyy"`) and return it as an ISO year-month string, `YYYY-MM`.
 *
 * - **Decoding, not display.** This reads a *known, fixed* producer format. A pattern with a day,
 *   weekday or time token returns `""` — use `parseDateWithPattern` for a full date.
 * - The pattern needs both a year and a month, otherwise `""`.
 * - Digits are ASCII, as in the other pattern parsers.
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `yyyy` | year | 4 digits | 0000–9999 | |
 * | `yy` | year | 2 digits | — | Read through `options.yearWindow`; with no window the result is `""` |
 * | `MM` | month | 2 digits | 01–12 | |
 * | `M` | month | 1-2 digits | 1–12 | |
 * | `MMMM` | month name (long) | locale | — | Reads the format-context name ("октября") or the stand-alone name ("октябрь"); UTS #35 Part 4, Parsing Dates and Times |
 * | `MMM` | month name (short) | locale | — | Reads either context, as `MMMM` |
 * | `LL` | month | 2 digits | 01–12 | Stand-alone context; read as `MM` |
 * | `L` | month | 1-2 digits | 1–12 | Stand-alone context; read as `M` |
 * | `LLLL` | month name (long) | locale | — | Same names as `MMMM` |
 * | `LLL` | month name (short) | locale | — | Same names as `MMM` |
 * | `GG` / `GGGG` | era | locale | — | Qualifies the year: 1 BC is year 0000 |
 *
 * - Literal text follows UTS #35: text in `'single quotes'` is a literal, `''` is one literal
 *   quote, and a quote that never closes makes the pattern malformed (`""`).
 * - Month names match case-insensitively. A `-u-ca-` locale extension is overridden to Gregorian.
 * - Name tokens are locale-aware. If `locale` is omitted (or an empty list) and the pattern uses
 *   one, GMT reads English names in `"en"`. An ill-formed tag returns `""`.
 *
 * @param value The string to decode (e.g. "10/2026")
 * @param pattern The token pattern describing `value`'s shape (e.g. "MM/yyyy")
 * @param locale Optional BCP 47 locale tag, or a preference list of tags, for name-based tokens (default "en")
 * @param options The hundred-year window a `yy` token resolves in
 * @returns the `YYYY-MM` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseYearMonthWithPattern("10/2026", "MM/yyyy") // "2026-10"
 * @example parseYearMonthWithPattern("octobre 2026", "MMMM yyyy", "fr") // "2026-10"
 * @example parseYearMonthWithPattern("10/26", "MM/yy", undefined, { yearWindow: 1950 }) // "2026-10"
 * @example parseYearMonthWithPattern("13/2026", "MM/yyyy") // ""
 * @example parseYearMonthWithPattern("1 octobre 2026", "d MMMM yyyy", "fr-FR") // "" (day token)
 */
export function parseYearMonthWithPattern(
  value: string,
  pattern: string,
  locale?: string | string[],
  options?: TwoDigitYearOptions,
): string {
  try {
    if (typeof value !== "string") return "";
    if (typeof pattern !== "string") return "";
    if (!isOptionsArgument(options)) return "";

    const fields = parseValueWithPattern(
      value,
      pattern,
      locale,
      YEAR_MONTH_PATTERN_FIELDS,
      options,
    );
    if (fields === null) return "";
    if (fields.year === undefined || fields.month === undefined) return "";

    // The regex proves the shape only; `overflow: "reject"` refuses month 13.
    return yearMonthString(
      Temporal.PlainYearMonth.from(
        { year: fields.year, month: fields.month },
        { overflow: "reject" },
      ),
    );
  } catch {
    return "";
  }
}
