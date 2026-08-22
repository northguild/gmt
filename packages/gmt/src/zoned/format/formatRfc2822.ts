import { Temporal } from "@js-temporal/polyfill";
import { ENGLISH_MONTH_NAMES, ENGLISH_WEEKDAY_NAMES } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned ISO 8601 datetime string as an RFC 5322 (RFC 2822) date-time
 * — the fixed grammar email `Date:` headers require.
 *
 * - **Fixed grammar, not a display format.** RFC 5322 mandates English
 *   weekday/month abbreviations and a numeric `+HHMM`/`-HHMM` offset
 *   regardless of caller locale — there is no locale-appropriate alternative
 *   ordering to lose, so this does not conflict with Decision 1's exclusion
 *   of a general token formatter (see roadmap `issues/J.md`, J13).
 * - Uses the input's own UTC offset at that instant (DST-aware); never emits
 *   an obsolete named zone like "GMT" or "EST" on output, only numeric.
 * - Day, hour, minute, and second are always zero-padded to 2 digits; year
 *   is zero-padded to 4 digits.
 *
 * @param value zoned ISO 8601 datetime string (e.g. "2024-03-15T14:30:00-04:00[America/New_York]")
 * @returns RFC 5322 date-time string, or "" on invalid input
 *
 * @example formatRfc2822("2024-03-15T14:30:00-04:00[America/New_York]") // "Fri, 15 Mar 2024 14:30:00 -0400"
 * @example formatRfc2822("2024-01-05T09:00:00+00:00[UTC]") // "Fri, 05 Jan 2024 09:00:00 +0000"
 * @example formatRfc2822("invalid") // ""
 */
export function formatRfc2822(value: string): string {
  if (!isValidZonedDateTime(value)) return "";

  try {
    const zdt = Temporal.ZonedDateTime.from(value);

    const weekday = ENGLISH_WEEKDAY_NAMES[zdt.dayOfWeek - 1];
    const day = String(zdt.day).padStart(2, "0");
    const month = ENGLISH_MONTH_NAMES[zdt.month - 1];
    const year = String(zdt.year).padStart(4, "0");
    const hour = String(zdt.hour).padStart(2, "0");
    const minute = String(zdt.minute).padStart(2, "0");
    const second = String(zdt.second).padStart(2, "0");

    const totalOffsetMinutes = zdt.offsetNanoseconds / 60_000_000_000;
    const sign = totalOffsetMinutes < 0 ? "-" : "+";
    const absMinutes = Math.abs(totalOffsetMinutes);
    const offsetHH = String(Math.trunc(absMinutes / 60)).padStart(2, "0");
    const offsetMM = String(absMinutes % 60).padStart(2, "0");

    return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} ${sign}${offsetHH}${offsetMM}`;
  } catch {
    return "";
  }
}
