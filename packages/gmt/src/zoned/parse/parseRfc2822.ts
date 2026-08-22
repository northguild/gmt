import { Temporal } from "@js-temporal/polyfill";
import { ENGLISH_MONTH_NAMES } from "../../internal";
import { rfc2822DateTime } from "../../regex";

// RFC 5322 §4.3 "obsolete date and time" — named zones an email parser must
// still accept even though `formatRfc2822` never emits them. Any obs-zone
// single-letter military zone outside this table is unrecognized ("" per
// the spec's own admission that those are ambiguous) and rejected.
const NAMED_ZONE_OFFSETS: Record<string, string> = {
  UT: "+0000",
  GMT: "+0000",
  EST: "-0500",
  EDT: "-0400",
  CST: "-0600",
  CDT: "-0500",
  MST: "-0700",
  MDT: "-0600",
  PST: "-0800",
  PDT: "-0700",
};

/**
 * Parse an RFC 5322 (RFC 2822) date-time string — the fixed grammar email
 * `Date:` headers use — into a zoned ISO 8601 datetime string.
 *
 * - **Decoding, not display.** Accepts English weekday/month abbreviations
 *   only, per the fixed grammar (see `formatRfc2822`'s JSDoc and roadmap
 *   Decision 1).
 * - Accepts a leading day-of-week (not cross-validated against the computed
 *   date, the same deliberate scope limit `parseDateTimeWithPattern`/J11
 *   uses for its `EEEE`/`EEE` tokens) and an optional `:ss` seconds field.
 * - Accepts a 1- or 2-digit day (the formal grammar's `1*2DIGIT`), unlike
 *   `parseHttp`/`parseSql`, which both require exactly 2 digits.
 * - Accepts a numeric `+HHMM`/`-HHMM` offset or one of RFC 5322's obsolete
 *   named zones (`GMT`, `UT`, and the eight North American zones); any other
 *   obs-zone letter is unrecognized and rejected.
 * - The resulting offset becomes the zoned string's time zone identifier
 *   (e.g. `-05:00`), since RFC 2822 carries no IANA zone name to recover.
 *
 * @param value RFC 5322 date-time string (e.g. "Fri, 15 Mar 2024 14:30:00 -0400")
 * @returns zoned ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0400") // "2024-03-15T14:30:00-04:00[-04:00]"
 * @example parseRfc2822("5 Jan 2024 09:00:00 GMT") // "2024-01-05T09:00:00+00:00[+00:00]"
 * @example parseRfc2822("not a date") // ""
 */
export function parseRfc2822(value: string): string {
  if (typeof value !== "string") return "";

  const match = rfc2822DateTime.exec(value);
  if (match === null) return "";

  const [, , dayStr, monthName, yearStr, hourStr, minuteStr, secondStr, zone] =
    match;

  const monthIndex = ENGLISH_MONTH_NAMES.indexOf(
    monthName as (typeof ENGLISH_MONTH_NAMES)[number],
  );
  if (monthIndex === -1) return "";

  const numericOffset = NAMED_ZONE_OFFSETS[zone] ?? zone;
  const offset = `${numericOffset.slice(0, 3)}:${numericOffset.slice(3)}`;

  try {
    const plainDateTime = Temporal.PlainDateTime.from(
      {
        year: Number(yearStr),
        month: monthIndex + 1,
        day: Number(dayStr),
        hour: Number(hourStr),
        minute: Number(minuteStr),
        second: secondStr === undefined ? 0 : Number(secondStr),
      },
      { overflow: "reject" },
    );

    return plainDateTime.toZonedDateTime(offset).toString();
  } catch {
    return "";
  }
}
