import { Temporal } from "@js-temporal/polyfill";
import { parseValueWithPattern, TIME_PATTERN_FIELDS } from "../../internal";

/**
 * Parse a time string against a caller-supplied token pattern (e.g.
 * `"HH:mm:ss"`, `"h:mm a"`) and return it as an ISO `PlainTime` string.
 *
 * - **Decoding, not display.** This is for consuming a *known, fixed*
 *   producer format — a CSV column, a legacy API field, a partially-typed
 *   form value — not for generating locale-correct output. For display,
 *   use `formatTime`/`formatDateToParts`, which order fields per locale
 *   instead of hard-coding a field order (see roadmap Decision 1 — a
 *   token *formatter*, the inverse of this function, is deliberately out
 *   of scope for GMT).
 * - `pattern` accepts only time-shaped tokens. A pattern containing a
 *   date-only token (`y M d E G`) is malformed for this function and
 *   returns `""` — use `parseDateTimeWithPattern` for combined input.
 *
 * ### Token table
 * | Token | Field | Width | Range | Notes |
 * |---|---|---|---|---|
 * | `HH` | hour (24h) | 2 digits | 00–23 | |
 * | `H` | hour (24h) | 1-2 digits | 0–23 | |
 * | `hh` | hour (12h) | 2 digits | 01–12 | needs `a` to resolve to 24h — see below |
 * | `h` | hour (12h) | 1-2 digits | 1–12 | same |
 * | `mm` | minute | 2 digits | 00–59 | |
 * | `m` | minute | 1-2 digits | 0–59 | |
 * | `ss` | second | 2 digits | 00–59 | |
 * | `s` | second | 1-2 digits | 0–59 | |
 * | `SSS` | millisecond | 3 digits | 000–999 | |
 * | `a` | meridiem | locale | — | `getLocaleMeridiems(locale)` → `[AM-label, PM-label]` |
 *
 * - Text in `'single quotes'` is a literal; a doubled `''` inside a
 *   quoted segment is a literal `'`. Any other character (`: , space`,
 *   literal digits, etc.) outside a quote/letter-run is automatically a
 *   literal — no explicit quoting required.
 * - `a` is locale-aware. If `locale` is omitted and the pattern uses
 *   `a`, GMT defaults to `"en-US"` rather than returning `""` for every
 *   caller who didn't have another locale in mind.
 * - `h`/`hh` resolve to 24-hour using a matched `a` token: if the label
 *   is the PM label and hour !== 12, add 12; if the AM label and hour
 *   === 12, set hour to 0. With no `a` token in the pattern at all, the
 *   pattern is still valid but the hour stays ambiguous — GMT resolves
 *   it as if AM had matched (12 → 0, otherwise unchanged).
 * - A shape-valid match does not by itself prove a real time: extracted
 *   fields are always handed to `Temporal.PlainTime.from(fields, {
 *   overflow: "reject" })` — the regex only proves the shape, Temporal
 *   proves the time is real.
 *
 * @param value The string to decode (e.g. "02:30:45 PM")
 * @param pattern The token pattern describing `value`'s shape (e.g. "hh:mm:ss a")
 * @param locale Optional BCP 47 locale for the meridiem token (default "en-US")
 * @returns ISO `PlainTime` string, or "" on no match, malformed pattern, or invalid input
 *
 * @example parseTimeWithPattern("14:30:45", "HH:mm:ss") // "14:30:45"
 * @example parseTimeWithPattern("02:30:45 PM", "hh:mm:ss a") // "14:30:45"
 * @example parseTimeWithPattern("25:00", "HH:mm") // "" (shape-valid, not a real time)
 * @example parseTimeWithPattern("2024-03-15", "yyyy-MM-dd") // "" (date token in a time-only pattern)
 */
export function parseTimeWithPattern(
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
    TIME_PATTERN_FIELDS,
  );
  if (fields === null) return "";

  try {
    // The regex only proved `value` has the right *shape* for `pattern`
    // (e.g. "25:00" matches "HH:mm") — Temporal is what proves the time
    // is real: `overflow: "reject"` throws instead of silently clamping
    // an out-of-range field, which is what the default "constrain" would
    // do.
    return Temporal.PlainTime.from(
      {
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
