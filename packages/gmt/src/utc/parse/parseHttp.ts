import { Temporal } from "@js-temporal/polyfill";
import { ENGLISH_MONTH_NAMES } from "../../internal";
import { httpDate } from "../../regex";

/**
 * Parse an RFC 7231 IMF-fixdate string — the fixed grammar HTTP headers like
 * `Last-Modified`/`Date`/`Expires` use — into a UTC ISO 8601 datetime string.
 *
 * - **Decoding, not display.** Accepts English weekday/month abbreviations
 *   only, per the fixed grammar (see `formatHttp`'s JSDoc and roadmap
 *   Decision 1).
 * - **IMF-fixdate only.** RFC 7231 also lists two obsolete forms
 *   (`rfc850-date`, `asctime-date`) that real HTTP servers occasionally
 *   still emit; this is a documented limitation — neither is accepted here.
 * - Day, hour, minute, and second must each be exactly 2 digits and the
 *   trailing zone must be the literal `GMT` — unlike `parseRfc2822`, no
 *   numeric offset or named-zone table is accepted.
 * - The day-of-week is not cross-validated against the computed date, the
 *   same deliberate scope limit `parseDateTimeWithPattern`/J11 uses.
 *
 * @param value RFC 7231 IMF-fixdate string (e.g. "Fri, 15 Mar 2024 14:30:00 GMT")
 * @returns UTC ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseHttp("Fri, 15 Mar 2024 14:30:00 GMT") // "2024-03-15T14:30:00Z"
 * @example parseHttp("Fri, 15 Mar 2024 14:30:00 -0400") // "" (not IMF-fixdate)
 * @example parseHttp("not a date") // ""
 */
export function parseHttp(value: string): string {
  if (typeof value !== "string") return "";

  const match = httpDate.exec(value);
  if (match === null) return "";

  const [, , dayStr, monthName, yearStr, hourStr, minuteStr, secondStr] = match;

  const monthIndex = ENGLISH_MONTH_NAMES.indexOf(
    monthName as (typeof ENGLISH_MONTH_NAMES)[number],
  );
  if (monthIndex === -1) return "";

  try {
    const plainDateTime = Temporal.PlainDateTime.from(
      {
        year: Number(yearStr),
        month: monthIndex + 1,
        day: Number(dayStr),
        hour: Number(hourStr),
        minute: Number(minuteStr),
        second: Number(secondStr),
      },
      { overflow: "reject" },
    );

    return plainDateTime.toZonedDateTime("UTC").toInstant().toString();
  } catch {
    return "";
  }
}
