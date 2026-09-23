import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

const NANOSECONDS_PER_MINUTE = 60_000_000_000;

/**
 * Format a zoned ISO 8601 datetime string as strict RFC 3339 — the ISO 8601
 * *profile* RFC 3339 §5.6 defines, permitting only an explicit numeric
 * offset or `Z`, never a bracketed IANA zone name.
 *
 * - **Not a passthrough.** GMT's own zoned strings always carry a bracketed
 *   IANA zone annotation (e.g. `...+00:00[UTC]`) that plain
 *   `Temporal.ZonedDateTime.prototype.toString()` reproduces by default —
 *   that annotation is *not* valid RFC 3339. This function's only job is to
 *   strip it (`{ timeZoneName: "never" }`), which is exactly the detail a
 *   caller reaching for "give me RFC 3339" would otherwise miss. (Go/no-go
 *   recorded in roadmap `issues/J.md` J13: this narrow gap is real; a
 *   parallel `utc`/`unix` wrapper was *not* added, because
 *   `Temporal.Instant.prototype.toString()` is already fully RFC 3339
 *   compliant with no bracket to strip — that would be a pure passthrough.)
 * - **Sub-minute offsets are written in UTC.** `time-numoffset` holds whole minutes, and RFC 3339
 *   §4.2 says historical offsets that are not ("applications must convert them to a representable
 *   time zone"). A local mean time such as Africa/Monrovia's −00:44:30 is therefore written as the
 *   same instant at `+00:00`. `Z` is not used: RFC 9557 §2.2 gives it the meaning "the offset to
 *   local time is unknown", and here the offset is known, only not representable.
 * - Returns `""` for a year outside `date-fullyear = 4DIGIT` (0000–9999).
 * - Fractional seconds are kept, with trailing zeros dropped.
 * - **Compatibility:** before 1.16.0 a sub-minute offset was rounded to the minute, naming a
 *   different instant, and years outside 0000–9999 were written in expanded form. For either
 *   string use `Temporal.ZonedDateTime#toString({ timeZoneName: "never" })`.
 *
 * @param value zoned ISO 8601 datetime string (e.g. "2024-03-15T14:30:00-04:00[America/New_York]")
 * @returns RFC 3339 datetime string, or "" on invalid input or a year outside 0000–9999
 *
 * @example formatRfc3339("2024-03-15T14:30:00-04:00[America/New_York]") // "2024-03-15T14:30:00-04:00"
 * @example formatRfc3339("2024-03-15T14:30:00Z[UTC]") // "2024-03-15T14:30:00+00:00"
 * @example formatRfc3339("1969-12-31T23:15:30-00:45[Africa/Monrovia]") // "1970-01-01T00:00:00+00:00" (offset −00:44:30)
 * @example formatRfc3339("+010000-01-01T00:00:00+00:00[UTC]") // ""
 * @example Temporal.ZonedDateTime.from("1969-12-31T23:15:30-00:45[Africa/Monrovia]").toString({ timeZoneName: "never" }) // "1969-12-31T23:15:30-00:45" — the pre-1.16.0 output
 * @example formatRfc3339("invalid") // ""
 */
export function formatRfc3339(value: string): string {
  if (!isValidZonedDateTime(value)) return "";

  try {
    const zdt = zonedDateTimeFrom(value);
    // time-numoffset holds whole minutes. A local mean time offset (e.g.
    // Africa/Monrovia -00:44:30) would be rounded by toString into a string
    // naming a different instant; RFC 3339 §4.2 NOTE: "applications must
    // convert them to a representable time zone" — UTC.
    const target =
      zdt.offsetNanoseconds % NANOSECONDS_PER_MINUTE === 0
        ? zdt
        : zdt.withTimeZone("UTC");
    // date-fullyear = 4DIGIT (RFC 3339 §5.6).
    const { year } = target.toPlainDate().withCalendar("iso8601");
    if (year < 0 || year > 9999) return "";
    return target.toString({
      timeZoneName: "never",
    });
  } catch {
    return "";
  }
}
