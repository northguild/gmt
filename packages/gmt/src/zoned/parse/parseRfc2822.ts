import { Temporal } from "@js-temporal/polyfill";
import { readRfc5322DateTime } from "../../internal/rfc5322DateTime";

/**
 * Parse an RFC 5322 (RFC 2822) date-time string — the fixed grammar email
 * `Date:` headers use — into a zoned ISO 8601 datetime string.
 *
 * - **Decoding, not display.** Weekday and month names are English, per the
 *   fixed grammar (see `formatRfc2822`'s JSDoc and roadmap Decision 1); like
 *   every ABNF literal they match in any case (RFC 5234 §2.3).
 * - **Reads what a conformant receiver must.** RFC 5322 §3.3 syntax: folding
 *   white space (spaces, tabs, folded lines), nested comments such as a
 *   trailing `(EDT)`, a 1- or 2-digit day, a 4-or-more-digit year and optional
 *   seconds. §4 obsolete syntax, which "MUST be accepted and parsed": comments
 *   and white space between any tokens, and 2- or 3-digit years (00–49 → 20xx,
 *   50–99 → 19xx, 3 digits → +1900).
 * - **Zones.** A numeric `+hhmm`/`-hhmm` (minutes 00–59), or an obsolete
 *   alphabetic zone: `UT`/`GMT` are `+0000`, and `EST`/`EDT`/`CST`/`CDT`/
 *   `MST`/`MDT`/`PST`/`PDT` have the offsets §4.3 gives them. Military
 *   one-letter zones and any other alphabetic zone are read as `-0000`, as
 *   §4.3 says they SHOULD be; `J` is not a zone and returns `""`.
 * - **`-0000` and `+0000` both become `+00:00`.** RFC 5322 §3.3 gives `-0000`
 *   the meaning "no information about the local time zone"; a Temporal offset
 *   cannot carry that distinction, so it is lost.
 * - **The day-of-week must match the date.** RFC 5322 §3.3: "the day-of-week
 *   (if included) MUST be the day implied by the date". A mismatch returns `""`.
 * - The resulting offset becomes the zoned string's time zone identifier
 *   (e.g. `-05:00`), since RFC 5322 carries no IANA zone name to recover.
 *   An offset of 24 hours or more cannot be represented and returns `""`.
 * - An impossible calendar date (`31 Feb`, `29 Feb 2023`) returns `""`: a parser never
 *   invents a date, so fields are validated with `overflow: "reject"`, not clamped.
 * - For the strict current-syntax shape alone, test the exported `rfc2822DateTime` pattern.
 * - **Compatibility:** before 1.16.0 a day-of-week that did not match the date was ignored.
 *   Remove the day-of-week to parse such a string: the date alone decides the result.
 *
 * @param value RFC 5322 date-time string (e.g. "Fri, 15 Mar 2024 14:30:00 -0400")
 * @returns zoned ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0400") // "2024-03-15T14:30:00-04:00[-04:00]"
 * @example parseRfc2822("5 Jan 2024 09:00:00 GMT") // "2024-01-05T09:00:00+00:00[+00:00]"
 * @example parseRfc2822("fri,15 Mar 24 14:30 -0400 (EDT)") // "2024-03-15T14:30:00-04:00[-04:00]" (obsolete 2-digit year, comment)
 * @example parseRfc2822("Fri, 15 Mar 2024 14:30:00 CEST") // "2024-03-15T14:30:00+00:00[+00:00]" (unknown zone → -0000)
 * @example parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0000") // "2024-03-15T14:30:00+00:00[+00:00]"
 * @example parseRfc2822("Sat, 15 Mar 2024 14:30:00 -0400") // "" (15 Mar 2024 was a Friday)
 * @example parseRfc2822("15 Mar 2024 14:30:00 -0400") // "2024-03-15T14:30:00-04:00[-04:00]" — the weekday removed
 * @example parseRfc2822("Sat, 31 Feb 2024 14:30:00 -0400") // "" (impossible date)
 * @example parseRfc2822("not a date") // ""
 */
export function parseRfc2822(value: string): string {
  if (typeof value !== "string") return "";

  const fields = readRfc5322DateTime(value);
  if (fields === null) return "";

  try {
    const plainDateTime = Temporal.PlainDateTime.from(
      {
        year: fields.year,
        month: fields.month,
        day: fields.day,
        hour: fields.hour,
        minute: fields.minute,
        second: fields.second,
      },
      { overflow: "reject" },
    );
    // "the day-of-week (if included) MUST be the day implied by the date"
    if (
      fields.dayOfWeek !== undefined &&
      fields.dayOfWeek !== plainDateTime.dayOfWeek
    ) {
      return "";
    }

    return plainDateTime.toZonedDateTime(fields.offset).toString();
  } catch {
    return "";
  }
}
