import {
  formatZonedInCalendar,
  isEthiopicFamilyCalendar,
  parseCalendarZonedValue,
  temporalCalendarIds,
} from "../../internal";
import type { CalendarSystem } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Convert a zoned datetime to the same instant expressed in a different calendar system.
 *
 * - Accepts a bare ISO zoned datetime ("2024-10-03T14:30:45-04:00[America/New_York]") or a
 *   calendar-annotated zoned datetime previously produced by this function
 *   ("5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"), so conversions can chain
 *   between calendar systems.
 * - The instant, the wall time, the UTC offset and the IANA zone are all unchanged — only the
 *   calendar the date fields resolve through changes.
 * - The output for "gregorian" is always a bare, unannotated ISO zoned string, matching every
 *   other GMT zoned string. Any other calendar returns its own native year/month/day tagged with
 *   `[u-ca=<identifier>]`, placed BEFORE the `[timeZone]` segment.
 * - **The segment ordering `[u-ca=...][timeZone]` is the reverse of RFC 9557 and is deliberate.**
 *   GMT's digits are calendar-native, so the string is never valid RFC 9557 anyway; ordering the
 *   annotation first makes Temporal reject the whole shape instead of silently misreading a
 *   Hebrew year 5784 as ISO year 5784. See `regex/calendar-zoned-date-time.ts`.
 * - Uses Temporal's built-in calendar support for every calendar except the Ethiopic family
 *   ("ethiopic" / "ethiopic-amete-alem" / "coptic"), which is computed with GMT-owned arithmetic
 *   through the ICU-independent "ethioaa" carrier — see `internal/ethiopicFamilyCalendar.ts`.
 * - Returns "" on invalid input or an unsupported `calendar`.
 *
 * "japanese" and "ethiopic" are the two calendars tagged with an era instead of a plain native
 * year — see the README's calendar-systems section for why.
 *
 * @param value ISO zoned datetime string, optionally calendar-annotated
 * @param calendar target calendar system ("gregorian" | "hebrew" | "islamic-civil" |
 *   "islamic-tabular" | "islamic-umalqura" | "japanese" | "buddhist" | "taiwan" |
 *   "persian" | "indian" | "ethiopic" | "ethiopic-amete-alem" | "coptic")
 * @returns calendar-native zoned datetime string, or "" on invalid input
 *
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew") // "5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"
 * @example convertZonedToCalendar("5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]", "gregorian") // "2024-10-03T14:30:45-04:00[America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "gregorian") // "2024-10-03T14:30:45-04:00[America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "islamic-civil") // "1446-03-29T14:30:45-04:00[u-ca=islamic-civil][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "islamic-tabular") // "1446-03-30T14:30:45-04:00[u-ca=islamic-tabular][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "islamic-umalqura") // "1446-03-30T14:30:45-04:00[u-ca=islamic-umalqura][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "japanese") // "0006-10-03T14:30:45-04:00[u-ca=japanese;era=reiwa][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "buddhist") // "2567-10-03T14:30:45-04:00[u-ca=buddhist][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "taiwan") // "0113-10-03T14:30:45-04:00[u-ca=taiwan][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "persian") // "1403-07-12T14:30:45-04:00[u-ca=persian][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "indian") // "1946-07-11T14:30:45-04:00[u-ca=indian][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "ethiopic") // "2017-01-23T14:30:45-04:00[u-ca=ethiopic;era=ethiopic][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "ethiopic-amete-alem") // "7517-01-23T14:30:45-04:00[u-ca=ethiopic-amete-alem][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "coptic") // "1741-01-23T14:30:45-04:00[u-ca=coptic][America/New_York]"
 * @example convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]", "gregorian") // "" (Temporal's segment ordering is not GMT's grammar)
 * @example convertZonedToCalendar("invalid", "hebrew") // ""
 */
export function convertZonedToCalendar(
  value: string,
  calendar: CalendarSystem,
): string {
  if (
    !isValidCalendarZonedDateTime(value) ||
    !(calendar in temporalCalendarIds)
  ) {
    return "";
  }

  try {
    const zoned = parseCalendarZonedValue(value);
    // The whole Ethiopic family computes through "ethioaa" rather than Temporal's own
    // "ethiopic"/"coptic" ids, which throw under ICU >= 78 — see internal/ethiopicFamilyCalendar.ts.
    const temporalCalendarId = isEthiopicFamilyCalendar(calendar)
      ? "ethioaa"
      : temporalCalendarIds[calendar];
    return formatZonedInCalendar(
      zoned.withCalendar(temporalCalendarId),
      calendar,
    );
  } catch {
    return "";
  }
}
