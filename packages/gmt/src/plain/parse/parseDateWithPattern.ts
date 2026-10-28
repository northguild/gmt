// fallow-ignore-file code-duplication -- sibling of parseDateTimeWithPattern; each keeps its own guard, options check and try/catch, by design
import { Temporal } from "../../internal/temporal";
import {
  DATE_PATTERN_FIELDS,
  isOptionsArgument,
  parseValueWithPattern,
} from "../../internal";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse a date string against a caller-supplied token pattern (e.g.
 * `"dd/MM/yyyy"`, `"dd-MMM-yyyy"`) and return it as an ISO `PlainDate`
 * string.
 *
 * - **Decoding, not display.** This is for consuming a *known, fixed*
 *   producer format — a CSV column, a legacy API field, a partially-typed
 *   form value — not for generating locale-correct output. For display,
 *   use `formatDate`/`formatDateToParts`, which order fields per locale
 *   instead of hard-coding a field order (a token *formatter*, the
 *   inverse of this function, is deliberately out of scope for GMT).
 * - `pattern` accepts only date-shaped tokens. A pattern containing a
 *   time-only token (`H h m s S a`) is malformed for this function and
 *   returns `""` — use `parseDateTimeWithPattern` for combined input.
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `yyyy` | year | 4 digits | 0000–9999 | |
 * | `yy` | year | 2 digits | 00–99 | Needs `options.yearWindow`; returns `""` without it |
 * | `MM` | month | 2 digits | 01–12 | |
 * | `M` | month | 1-2 digits | 1–12 | |
 * | `MMMM` | month name (long) | locale | — | Reads the format-context name ("марта") or the stand-alone name ("март"); UTS #35 Part 4, Parsing Dates and Times |
 * | `MMM` | month name (short) | locale | — | Reads either context, as `MMMM` ("März" and "Mär" in `de`) |
 * | `LL` | month | 2 digits | 01–12 | Stand-alone context; read as `MM` |
 * | `L` | month | 1-2 digits | 1–12 | Stand-alone context; read as `M` |
 * | `LLLL` | month name (long) | locale | — | Same names as `MMMM` |
 * | `LLL` | month name (short) | locale | — | Same names as `MMM` |
 * | `dd` | day | 2 digits | 01–31 | |
 * | `d` | day | 1-2 digits | 1–31 | |
 * | `EEEE` | weekday name (long) | locale | — | consumed, NOT cross-validated against the date (see below) |
 * | `EEE` | weekday name (short) | locale | — | same |
 * | `GGGG` | era name (long) | locale | — | BCE label ⇒ final year = 1 − parsed year |
 * | `GG` | era name (short) | locale | — | same resolution |
 *
 * - Literal text follows the Unicode UTS #35 date format pattern rules.
 *   Text in `'single quotes'` is a literal, letters included. Two
 *   adjacent quotes `''` are one literal `'`, inside or outside quoted
 *   text: `"yyyy''MM"` reads `"2024'03"`, and `"'o''clock'"` reads
 *   `"o'clock"`. A quote that never closes makes the pattern malformed
 *   (`""`). Any other character that is not a letter (`/ - , space`,
 *   digits and so on) is a literal with no quoting.
 * - `MMMM`/`MMM`/`LLLL`/`LLL`/`EEEE`/`EEE`/`GGGG`/`GG` are locale-aware. If `locale`
 *   is omitted (or an empty list) and the pattern uses any of them, GMT
 *   reads English names in `"en"`, the language with no region, rather
 *   than returning `""`. CLDR gives `"en"` the same names as `"en-US"`.
 *   Pass `locale` for any other language.
 * - `EEEE`/`EEE` are matched against the locale's weekday names but the
 *   result is **not** cross-checked against the constructed date — e.g.
 *   `"Monday, 2024-03-15"` parses successfully against
 *   `"EEEE, yyyy-MM-dd"` even though 2024-03-15 is actually a Friday.
 *   This is a deliberate scope limit (no second weekday-index-to-ISO-
 *   dayOfWeek mapping layer).
 * - Adjacent variable-width numeric tokens with no literal separator
 *   (e.g. `"dMyyyy"`) are inherently ambiguous: each becomes a greedy
 *   `\d{1,2}`/etc. in sequence, so the split between fields depends on
 *   regex backtracking, not on any documented rule. Prefer zero-padded
 *   tokens (`MM`, `dd`) or an explicit separator for reliable parsing.
 * - A shape-valid match does not by itself prove a real date: extracted
 *   fields are always handed to `Temporal.PlainDate.from(fields, {
 *   overflow: "reject" })`, so `"31/02/2024"` against `"dd/MM/yyyy"`
 *   still returns `""` — the regex only proves the shape, Temporal
 *   proves the date is real.
 * - A `yy` token needs the caller's hundred-year window,
 *   `options.yearWindow`: no standard says which century a two-digit
 *   year belongs to, and a cut-off built into a library is right today
 *   and wrong later. Without a valid window a `yy` pattern returns `""`.
 *   A pattern with no `yy` never reads the option, so a `"rolling"`
 *   window reads no clock for it. A two-digit year is a legacy form; a
 *   four-digit year is the one to ask a data source for.
 *
 * @param value The string to decode (e.g. "15/03/2024")
 * @param pattern The token pattern describing `value`'s shape (e.g. "dd/MM/yyyy")
 * @param locale Optional BCP 47 locale tag, or a preference list of tags, for name-based tokens (default "en")
 * @param options The hundred-year window a `yy` token resolves in
 * @returns ISO `PlainDate` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseDateWithPattern("15/03/2024", "dd/MM/yyyy") // "2024-03-15"
 * @example parseDateWithPattern("15-Mar-2024", "dd-MMM-yyyy") // "2024-03-15"
 * @example parseDateWithPattern("15 Mar '24", "d MMM ''yy", undefined, { yearWindow: 2000 }) // "2024-03-15" ('' is one literal quote)
 * @example parseDateWithPattern("15.03.24", "dd.MM.yy", undefined, { yearWindow: 1950 }) // "2024-03-15" (1950–2049 window)
 * @example parseDateWithPattern("15.03.99", "dd.MM.yy", undefined, { yearWindow: 1950 }) // "1999-03-15"
 * @example parseDateWithPattern("15.03.24", "dd.MM.yy", undefined, { yearWindow: "rolling" }) // "2024-03-15" (while the current UTC year is 1975–2074)
 * @example parseDateWithPattern("15.03.24", "dd.MM.yy") // "" (yy with no window)
 * @example parseDateWithPattern("03/15/2024", "MM/dd/yyyy", undefined, { yearWindow: 2000 }) // "2024-03-15" (US order; yyyy ignores the window)
 * @example parseDateWithPattern("31/02/2024", "dd/MM/yyyy") // "" (shape-valid, not a real date)
 * @example parseDateWithPattern("14:30", "HH:mm") // "" (time token in a date-only pattern)
 * @example parseDateWithPattern("19 mai 2024", "d MMMM yyyy", ["fr-FR", "en-US"]) // "2024-05-19"
 */
export function parseDateWithPattern(
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
      DATE_PATTERN_FIELDS,
      options,
    );
    if (fields === null) return "";

    try {
      // The regex only proved `value` has the right *shape* for `pattern`
      // (e.g. "02/31/2024" matches "MM/dd/yyyy") — Temporal is what proves
      // the date is real: `overflow: "reject"` throws instead of silently
      // clamping Feb 31 to Feb 29, which is what the default "constrain"
      // would do.
      return Temporal.PlainDate.from(
        { year: fields.year, month: fields.month, day: fields.day },
        { overflow: "reject" },
      ).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
