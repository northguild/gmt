import { ccsdsInstantText, readCcsdsAsciiB } from "../../internal";
import { Temporal } from "../../internal/temporal";

/**
 * Read a CCSDS ASCII Time Code B (`YYYY-DDDThh:mm:ss.d…dZ`, day of year) as an ISO 8601 UTC
 * instant string in calendar form.
 *
 * - CCSDS 301.0-B-4 §3.5.1.2. `DDD` is the day of the year, 001 to 365, or 366 in a leap year
 *   (the ISO 8601 ordinal date). The code is UTC, so a code without its optional `Z` is still
 *   read as UTC, never as a local time.
 * - Years 0001 to 9999, leading zeros in every field, upper-case `T` and `Z`, and `.` as the
 *   only decimal sign.
 * - The seconds must be present. A shorter subset such as `2024-167` or `2024-167T10:30`
 *   returns "", because it names a span of time, not an instant.
 * - The fraction keeps the digits as sent, trailing zeros included. Digits after the ninth are
 *   dropped, never rounded, because Temporal holds nanoseconds.
 * - A second of 60 is read only at one of the 27 inserted leap seconds (IERS table built into
 *   GMT) and is returned as `…T23:59:60Z`.
 *
 * @param value CCSDS ASCII Time Code B text
 * @returns the instant as `YYYY-MM-DDThh:mm:ss[.f]Z`, or "" when `value` is not a Code B time
 *
 * @example parseCcsdsAsciiB("1988-018T17:20:43.123456Z") // "1988-01-18T17:20:43.123456Z" — CCSDS's own example
 * @example parseCcsdsAsciiB("2024-366T12:00:00Z") // "2024-12-31T12:00:00Z" — day 366 of a leap year
 * @example parseCcsdsAsciiB("2023-366T12:00:00Z") // "" — 2023 has 365 days
 * @example parseCcsdsAsciiB("2016-366T23:59:60Z") // "2016-12-31T23:59:60Z" — the inserted second
 * @example parseCcsdsAsciiB("2024-167") // "" — a day, not an instant
 */
export function parseCcsdsAsciiB(value: string): string {
  try {
    const fields = readCcsdsAsciiB(value);
    if (fields === null) {
      return "";
    }
    const january1 = Temporal.PlainDate.from(
      { year: fields.year, month: 1, day: 1 },
      { overflow: "reject" },
    );
    if (fields.dayOfYear < 1 || fields.dayOfYear > january1.daysInYear) {
      return "";
    }
    return ccsdsInstantText(
      january1.add({ days: fields.dayOfYear - 1 }),
      fields,
    );
  } catch {
    return "";
  }
}
