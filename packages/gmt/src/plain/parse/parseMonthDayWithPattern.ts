import { Temporal } from "../../internal/temporal";
import {
  MONTH_DAY_PATTERN_FIELDS,
  parseValueWithPattern,
} from "../../internal";
import { monthDayString } from "../../internal/monthDay";

/**
 * Parse a month-day string against a caller-supplied token pattern (e.g. `"MM-dd"`,
 * `"d MMMM"`) and return it as an ISO month-day string, `--MM-DD`.
 *
 * - **Decoding, not display.** This reads a *known, fixed* producer format. A pattern with a year,
 *   weekday, era or time token returns `""` — use `parseDateWithPattern` for a full date.
 * - `--02-29` is valid: the month-day has no year, so 29 February exists. `--02-30` and
 *   `--04-31` do not, and return `""`.
 * - Digits are ASCII, as in the other pattern parsers.
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `MM` | month | 2 digits | 01–12 | |
 * | `M` | month | 1-2 digits | 1–12 | |
 * | `MMMM` | month name (long) | locale | — | Reads the format-context name ("марта") or the stand-alone name ("март"); UTS #35 Part 4, Parsing Dates and Times |
 * | `MMM` | month name (short) | locale | — | Reads either context, as `MMMM` |
 * | `LL` | month | 2 digits | 01–12 | Stand-alone context; read as `MM` |
 * | `L` | month | 1-2 digits | 1–12 | Stand-alone context; read as `M` |
 * | `LLLL` | month name (long) | locale | — | Same names as `MMMM` |
 * | `LLL` | month name (short) | locale | — | Same names as `MMM` |
 * | `dd` | day | 2 digits | 01–31 | |
 * | `d` | day | 1-2 digits | 1–31 | |
 *
 * - Literal text follows the Unicode UTS #35 date format pattern rules: text in `'single quotes'`
 *   is a literal, `''` is one literal quote, and a quote that never closes makes the pattern
 *   malformed (`""`).
 * - Adjacent variable-width numeric tokens with no literal separator (e.g. `"Md"`) are ambiguous:
 *   `parseMonthDayWithPattern("111", "Md")` gives `"--01-11"`, a split picked by regex
 *   backtracking, not by any rule. Prefer zero-padded tokens (`MM`, `dd`) or a separator.
 * - Any character other than A–Z and a–z is a literal (UTS #35), which is what makes
 *   `"d בMMMM"` and `"M月d日"` work.
 * - Month names match case-insensitively (UTS #35 Part 4, Parsing: "case variants should be
 *   accepted"): `"december 25"` against `"MMMM d"` gives `"--12-25"`.
 * - A `-u-ca-` locale extension is overridden to Gregorian:
 *   `parseMonthDayWithPattern("September 1", "MMMM d", "en-u-ca-islamic")` gives `"--09-01"`,
 *   and `"Ramadan 1"` gives `""`. A `-u-nu-` extension changes the names of a locale that writes
 *   its months with digits, as that locale prints them: in `"ja-JP-u-nu-hanidec"`, `"一二月25日"`
 *   against `"MMMMd日"` gives `"--12-25"` and `"12月25日"` gives `""`. Day digits are always ASCII.
 * - The pattern needs both a month and a day, otherwise `""`.
 * - Name tokens are locale-aware. If `locale` is omitted (or an empty list) and the pattern uses
 *   one, GMT reads English names in `"en"`. An ill-formed tag returns `""`.
 *
 * @param value The string to decode (e.g. "25 December")
 * @param pattern The token pattern describing `value`'s shape (e.g. "d MMMM")
 * @param locale Optional BCP 47 locale tag, or a preference list of tags, for name-based tokens (default "en")
 * @returns the `--MM-DD` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseMonthDayWithPattern("12-25", "MM-dd") // "--12-25"
 * @example parseMonthDayWithPattern("December 25", "MMMM d") // "--12-25"
 * @example parseMonthDayWithPattern("25 décembre", "d MMMM", ["fr-FR", "en-US"]) // "--12-25"
 * @example parseMonthDayWithPattern("2/29", "M/d") // "--02-29"
 * @example parseMonthDayWithPattern("2/30", "M/d") // ""
 * @example parseMonthDayWithPattern("25 décembre 2024", "d MMMM yyyy", "fr-FR") // "" (year token)
 */
export function parseMonthDayWithPattern(
  value: string,
  pattern: string,
  locale?: string | string[],
): string {
  try {
    if (typeof value !== "string") return "";
    if (typeof pattern !== "string") return "";

    const fields = parseValueWithPattern(
      value,
      pattern,
      locale,
      MONTH_DAY_PATTERN_FIELDS,
    );
    if (fields === null) return "";
    if (fields.month === undefined || fields.day === undefined) return "";

    // The regex proves the shape only; `overflow: "reject"` makes 30 February throw.
    return monthDayString(
      Temporal.PlainMonthDay.from(
        { month: fields.month, day: fields.day },
        { overflow: "reject" },
      ),
    );
  } catch {
    return "";
  }
}
