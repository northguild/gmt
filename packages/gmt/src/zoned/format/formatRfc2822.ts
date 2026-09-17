import { zonedDateTimeFrom } from "../../internal";
import { englishDateTimeStem } from "../../internal/englishCalendarNames";
import { isValidZonedDateTime } from "../validate";

const NANOSECONDS_PER_MINUTE = 60_000_000_000;

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
 * - Fractional seconds are truncated: `second = 2DIGIT` has no fraction.
 * - Returns `""` when the offset is not a whole number of minutes (local mean
 *   time, e.g. Africa/Monrovia −00:44:30 before 1972): `zone` is
 *   `("+" / "-") 4DIGIT`, meaning ±(hh·60 + mm) minutes.
 * - Returns `""` for a negative year: `year = 4*DIGIT` has no sign. Years of
 *   five or more digits are written in full.
 * - **Compatibility:** before 1.16.0 these inputs gave strings outside the
 *   grammar (`"-0044.5"`, `"00-1"`). For the value itself use
 *   `Temporal.ZonedDateTime#toString()`.
 *
 * @param value zoned ISO 8601 datetime string (e.g. "2024-03-15T14:30:00-04:00[America/New_York]")
 * @returns RFC 5322 date-time string, or "" on invalid input, a sub-minute offset or a negative year
 *
 * @example formatRfc2822("2024-03-15T14:30:00-04:00[America/New_York]") // "Fri, 15 Mar 2024 14:30:00 -0400"
 * @example formatRfc2822("2024-01-05T09:00:00+00:00[UTC]") // "Fri, 05 Jan 2024 09:00:00 +0000"
 * @example formatRfc2822("2024-03-15T14:30:00.999-04:00[America/New_York]") // "Fri, 15 Mar 2024 14:30:00 -0400"
 * @example formatRfc2822("1969-12-31T23:15:30-00:45[Africa/Monrovia]") // "" (offset −00:44:30)
 * @example formatRfc2822("-000001-06-15T12:00:00+00:00[UTC]") // ""
 * @example Temporal.ZonedDateTime.from("-000001-06-15T12:00:00+00:00[UTC]").toString() // "-000001-06-15T12:00:00+00:00[UTC]"
 * @example formatRfc2822("invalid") // ""
 */
export function formatRfc2822(value: string): string {
  if (!isValidZonedDateTime(value)) return "";

  try {
    const zdt = zonedDateTimeFrom(value);
    // zone = ("+" / "-") 4DIGIT counts whole minutes (RFC 5322 §3.3); a
    // local mean time offset such as -00:44:30 has no such form.
    if (zdt.offsetNanoseconds % NANOSECONDS_PER_MINUTE !== 0) return "";
    // year = 4*DIGIT: unsigned, so no negative (BCE) year.
    if (zdt.year < 0) return "";

    const totalOffsetMinutes = zdt.offsetNanoseconds / NANOSECONDS_PER_MINUTE;
    const sign = totalOffsetMinutes < 0 ? "-" : "+";
    const absMinutes = Math.abs(totalOffsetMinutes);
    const offsetHH = String(Math.trunc(absMinutes / 60)).padStart(2, "0");
    const offsetMM = String(absMinutes % 60).padStart(2, "0");

    return `${englishDateTimeStem(zdt)} ${sign}${offsetHH}${offsetMM}`;
  } catch {
    return "";
  }
}
