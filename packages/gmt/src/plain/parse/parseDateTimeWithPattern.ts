// fallow-ignore-file code-duplication -- sibling of parseDateWithPattern; each keeps its own guard, options check and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  DATE_TIME_PATTERN_FIELDS,
  isOptionsArgument,
  parseValueWithPattern,
} from "../../internal";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse a datetime string against a caller-supplied token pattern (e.g.
 * `"MM/dd/yyyy HH:mm:ss"`, `"dd-MMM-yyyy h:mm a"`) and return it as an
 * ISO `PlainDateTime` string.
 *
 * - **Decoding, not display.** This is for consuming a *known, fixed*
 *   producer format — a CSV column, a legacy API field, a partially-typed
 *   form value — not for generating locale-correct output. For display,
 *   use `formatDateTime`/`formatDateToParts`, which order fields per
 *   locale instead of hard-coding a field order (a token *formatter*,
 *   the inverse of this function, is deliberately out of scope for GMT).
 * - Accepts the full combined date + time token set (unlike
 *   `parseDateWithPattern`/`parseTimeWithPattern`, which each reject the
 *   other's tokens).
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `yyyy` | year | 4 digits | 0000–9999 | |
 * | `yy` | year | 2 digits | 00–99 | Needs `options.yearWindow`; returns `""` without it |
 * | `MM` | month | 2 digits | 01–12 | |
 * | `M` | month | 1-2 digits | 1–12 | |
 * | `MMMM` | month name (long) | locale | — | `getLocaleMonthNames(locale, "long")` |
 * | `MMM` | month name (short) | locale | — | `getLocaleMonthNames(locale, "short")` |
 * | `dd` | day | 2 digits | 01–31 | |
 * | `d` | day | 1-2 digits | 1–31 | |
 * | `HH` | hour (24h) | 2 digits | 00–23 | |
 * | `H` | hour (24h) | 1-2 digits | 0–23 | |
 * | `hh` | hour (12h) | 2 digits | 01–12 | needs `a` to resolve to 24h — see below |
 * | `h` | hour (12h) | 1-2 digits | 1–12 | same |
 * | `mm` | minute | 2 digits | 00–59 | |
 * | `m` | minute | 1-2 digits | 0–59 | |
 * | `ss` | second | 2 digits | 00–59 | |
 * | `s` | second | 1-2 digits | 0–59 | |
 * | `SSS` | millisecond | 3 digits | 000–999 | |
 * | `EEEE` | weekday name (long) | locale | — | consumed, NOT cross-validated against the date (see below) |
 * | `EEE` | weekday name (short) | locale | — | same |
 * | `a` | meridiem | locale | — | `getLocaleMeridiems(locale)` → `[AM-label, PM-label]` |
 * | `GGGG` | era name (long) | locale | — | BCE label ⇒ final year = 1 − parsed year |
 * | `GG` | era name (short) | locale | — | same resolution |
 *
 * - Literal text follows the Unicode UTS #35 date format pattern rules.
 *   Text in `'single quotes'` is a literal, letters included. Two
 *   adjacent quotes `''` are one literal `'`, inside or outside quoted
 *   text: `"yyyy''MM"` reads `"2024'03"`, and `"'o''clock'"` reads
 *   `"o'clock"`. A quote that never closes makes the pattern malformed
 *   (`""`). Any other character that is not a letter (`/ - , space :`,
 *   digits and so on) is a literal with no quoting.
 * - `MMMM`/`MMM`/`EEEE`/`EEE`/`a`/`GGGG`/`GG` are locale-aware. If
 *   `locale` is omitted and the pattern uses any of them, GMT defaults
 *   to `"en-US"` rather than returning `""` for every caller who didn't
 *   have another locale in mind.
 * - `EEEE`/`EEE` are matched against the locale's weekday names but the
 *   result is **not** cross-checked against the constructed date — e.g.
 *   `"Monday, 2024-03-15 14:00"` parses successfully against
 *   `"EEEE, yyyy-MM-dd HH:mm"` even though 2024-03-15 is actually a
 *   Friday. This is a deliberate scope limit (no second
 *   weekday-index-to-ISO-dayOfWeek mapping layer).
 * - `h`/`hh` resolve to 24-hour using a matched `a` token: if the label
 *   is the PM label and hour !== 12, add 12; if the AM label and hour
 *   === 12, set hour to 0. With no `a` token in the pattern at all, the
 *   pattern is still valid but the hour stays ambiguous — GMT resolves
 *   it as if AM had matched (12 → 0, otherwise unchanged).
 * - Adjacent variable-width numeric tokens with no literal separator
 *   (e.g. `"Mdyyyy"`) are inherently ambiguous: each becomes a greedy
 *   `\d{1,2}`/etc. in sequence, so the split between fields depends on
 *   regex backtracking, not on any documented rule. Prefer zero-padded
 *   tokens (`MM`, `dd`) or an explicit separator for reliable parsing.
 * - A shape-valid match does not by itself prove a real date/time:
 *   extracted fields are always handed to
 *   `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` — the
 *   regex only proves the shape, Temporal proves the value is real.
 * - Fields absent from `pattern` default the way `Temporal.PlainDateTime.from`
 *   defaults an omitted field (time fields default to `0`; `year`/`month`/`day`
 *   are still required for a valid result).
 * - A `yy` token needs the caller's hundred-year window,
 *   `options.yearWindow`: no standard says which century a two-digit
 *   year belongs to, and a cut-off built into a library is right today
 *   and wrong later. Without a valid window a `yy` pattern returns `""`.
 *   A pattern with no `yy` never reads the option, so a `"rolling"`
 *   window reads no clock for it. A two-digit year is a legacy form; a
 *   four-digit year is the one to ask a data source for.
 *
 * @param value The string to decode (e.g. "03/15/2024 14:30:00")
 * @param pattern The token pattern describing `value`'s shape (e.g. "MM/dd/yyyy HH:mm:ss")
 * @param locale Optional BCP 47 locale tag, or a preference list of tags, for name-based tokens (default "en-US")
 * @param options The hundred-year window a `yy` token resolves in
 * @returns ISO `PlainDateTime` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseDateTimeWithPattern("03/15/2024 14:30:00", "MM/dd/yyyy HH:mm:ss") // "2024-03-15T14:30:00"
 * @example parseDateTimeWithPattern("15-Mar-2024 02:30 PM", "dd-MMM-yyyy hh:mm a") // "2024-03-15T14:30:00"
 * @example parseDateTimeWithPattern("Mar 15, '24 at 14:30", "MMM d, ''yy 'at' HH:mm", undefined, { yearWindow: 2000 }) // "2024-03-15T14:30:00" ('' is one literal quote)
 * @example parseDateTimeWithPattern("99-03-15 14:30", "yy-MM-dd HH:mm", undefined, { yearWindow: 1950 }) // "1999-03-15T14:30:00" (1950–2049 window)
 * @example parseDateTimeWithPattern("24-03-15 14:30", "yy-MM-dd HH:mm", undefined, { yearWindow: "rolling" }) // "2024-03-15T14:30:00" (while the current UTC year is 1975–2074)
 * @example parseDateTimeWithPattern("24-03-15 14:30", "yy-MM-dd HH:mm") // "" (yy with no window)
 * @example parseDateTimeWithPattern("03/15/2024 14:30:00", "MM/dd/yyyy HH:mm:ss", undefined, { yearWindow: 2000 }) // "2024-03-15T14:30:00" (yyyy ignores the window)
 * @example parseDateTimeWithPattern("02/31/2024 14:30:00", "MM/dd/yyyy HH:mm:ss") // "" (shape-valid, not a real date)
 * @example parseDateTimeWithPattern("not a date", "MM/dd/yyyy HH:mm:ss") // ""
 * @example parseDateTimeWithPattern("19 mai 2024 10:20", "d MMMM yyyy HH:mm", ["fr-FR", "en-US"]) // "2024-05-19T10:20:00"
 */
export function parseDateTimeWithPattern(
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
      DATE_TIME_PATTERN_FIELDS,
      options,
    );
    if (fields === null) return "";

    try {
      // The regex only proved `value` has the right *shape* for `pattern`
      // (e.g. "02/31/2024 14:30:00" matches "MM/dd/yyyy HH:mm:ss") —
      // Temporal is what proves the value is real: `overflow: "reject"`
      // throws instead of silently clamping an out-of-range field, which
      // is what the default "constrain" would do.
      return Temporal.PlainDateTime.from(
        {
          year: fields.year,
          month: fields.month,
          day: fields.day,
          hour: fields.hour,
          minute: fields.minute,
          second: fields.second,
          millisecond: fields.millisecond,
        },
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
