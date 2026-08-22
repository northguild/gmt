import { Temporal } from "@js-temporal/polyfill";
import { DATE_PATTERN_FIELDS, parseValueWithPattern } from "../../internal";

/**
 * Parse a date string against a caller-supplied token pattern (e.g.
 * `"MM/dd/yyyy"`, `"dd-MMM-yyyy"`) and return it as an ISO `PlainDate`
 * string.
 *
 * - **Decoding, not display.** This is for consuming a *known, fixed*
 *   producer format — a CSV column, a legacy API field, a partially-typed
 *   form value — not for generating locale-correct output. For display,
 *   use `formatDate`/`formatDateToParts`, which order fields per locale
 *   instead of hard-coding a field order (see roadmap Decision 1 — a
 *   token *formatter*, the inverse of this function, is deliberately out
 *   of scope for GMT).
 * - `pattern` accepts only date-shaped tokens. A pattern containing a
 *   time-only token (`H h m s S a`) is malformed for this function and
 *   returns `""` — use `parseDateTimeWithPattern` for combined input.
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
 * | `EEEE` | weekday name (long) | locale | — | consumed, NOT cross-validated against the date (see below) |
 * | `EEE` | weekday name (short) | locale | — | same |
 * | `GGGG` | era name (long) | locale | — | BCE label ⇒ final year = 1 − parsed year |
 * | `GG` | era name (short) | locale | — | same resolution |
 *
 * - Text in `'single quotes'` is a literal; a doubled `''` inside a
 *   quoted segment is a literal `'`. Any other character (`/ - , space`,
 *   literal digits, etc.) outside a quote/letter-run is automatically a
 *   literal — no explicit quoting required.
 * - `MMMM`/`MMM`/`EEEE`/`EEE`/`GGGG`/`GG` are locale-aware. If `locale`
 *   is omitted and the pattern uses any of them, GMT defaults to
 *   `"en-US"` rather than returning `""` for every caller who didn't
 *   have another locale in mind — pass `locale` explicitly for others.
 * - `EEEE`/`EEE` are matched against the locale's weekday names but the
 *   result is **not** cross-checked against the constructed date — e.g.
 *   `"Monday, 2024-03-15"` parses successfully against
 *   `"EEEE, yyyy-MM-dd"` even though 2024-03-15 is actually a Friday.
 *   This is a deliberate scope limit (no second weekday-index-to-ISO-
 *   dayOfWeek mapping layer).
 * - Adjacent variable-width numeric tokens with no literal separator
 *   (e.g. `"Mdyyyy"`) are inherently ambiguous: each becomes a greedy
 *   `\d{1,2}`/etc. in sequence, so the split between fields depends on
 *   regex backtracking, not on any documented rule. Prefer zero-padded
 *   tokens (`MM`, `dd`) or an explicit separator for reliable parsing.
 * - A shape-valid match does not by itself prove a real date: extracted
 *   fields are always handed to `Temporal.PlainDate.from(fields, {
 *   overflow: "reject" })`, so `"02/31/2024"` against `"MM/dd/yyyy"`
 *   still returns `""` — the regex only proves the shape, Temporal
 *   proves the date is real.
 *
 * @param value The string to decode (e.g. "03/15/2024")
 * @param pattern The token pattern describing `value`'s shape (e.g. "MM/dd/yyyy")
 * @param locale Optional BCP 47 locale for name-based tokens (default "en-US")
 * @returns ISO `PlainDate` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseDateWithPattern("03/15/2024", "MM/dd/yyyy") // "2024-03-15"
 * @example parseDateWithPattern("15-Mar-2024", "dd-MMM-yyyy") // "2024-03-15"
 * @example parseDateWithPattern("02/31/2024", "MM/dd/yyyy") // "" (shape-valid, not a real date)
 * @example parseDateWithPattern("14:30", "HH:mm") // "" (time token in a date-only pattern)
 */
export function parseDateWithPattern(
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
    DATE_PATTERN_FIELDS,
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
}
