import { Temporal } from "@js-temporal/polyfill";
import {
  DATE_TIME_PATTERN_FIELDS,
  parseValueWithPattern,
} from "../../internal";

/**
 * Parse a datetime string against a caller-supplied token pattern (e.g.
 * `"MM/dd/yyyy HH:mm:ss"`, `"dd-MMM-yyyy h:mm a"`) and return it as an
 * ISO `PlainDateTime` string.
 *
 * - **Decoding, not display.** This is for consuming a *known, fixed*
 *   producer format — a CSV column, a legacy API field, a partially-typed
 *   form value — not for generating locale-correct output. For display,
 *   use `formatDateTime`/`formatDateToParts`, which order fields per
 *   locale instead of hard-coding a field order (see roadmap Decision 1
 *   — a token *formatter*, the inverse of this function, is deliberately
 *   out of scope for GMT).
 * - Accepts the full combined date + time token set (unlike
 *   `parseDateWithPattern`/`parseTimeWithPattern`, which each reject the
 *   other's tokens).
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `yyyy` | year | 4 digits | 0000–9999 | |
 * | `yy` | year | 2 digits | 00–99 | Pivot: 00–68 → 2000–2068, 69–99 → 1969–1999 (fixed rule) |
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
 * - Text in `'single quotes'` is a literal; a doubled `''` inside a
 *   quoted segment is a literal `'`. Any other character (`/ - , space
 *   :`, literal digits, etc.) outside a quote/letter-run is automatically
 *   a literal — no explicit quoting required.
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
 *
 * @param value The string to decode (e.g. "03/15/2024 14:30:00")
 * @param pattern The token pattern describing `value`'s shape (e.g. "MM/dd/yyyy HH:mm:ss")
 * @param locale Optional BCP 47 locale for name-based tokens (default "en-US")
 * @returns ISO `PlainDateTime` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseDateTimeWithPattern("03/15/2024 14:30:00", "MM/dd/yyyy HH:mm:ss") // "2024-03-15T14:30:00"
 * @example parseDateTimeWithPattern("15-Mar-2024 02:30 PM", "dd-MMM-yyyy hh:mm a") // "2024-03-15T14:30:00"
 * @example parseDateTimeWithPattern("02/31/2024 14:30:00", "MM/dd/yyyy HH:mm:ss") // "" (shape-valid, not a real date)
 * @example parseDateTimeWithPattern("not a date", "MM/dd/yyyy HH:mm:ss") // ""
 */
export function parseDateTimeWithPattern(
  value: string,
  pattern: string,
  locale?: string,
): string {
  if (typeof value !== "string") return "";
  if (typeof pattern !== "string") return "";
  if (locale !== undefined && typeof locale !== "string") return "";

  const fields = parseValueWithPattern(
    value,
    pattern,
    locale,
    DATE_TIME_PATTERN_FIELDS,
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
}
