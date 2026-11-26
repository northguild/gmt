import { Temporal } from "../../internal/temporal";
import { ccsdsInstantText, readCcsdsAsciiA } from "../../internal";

/**
 * Read a CCSDS ASCII Time Code A (`YYYY-MM-DDThh:mm:ss.d…dZ`) as an ISO 8601 UTC instant string.
 *
 * - CCSDS 301.0-B-4 §3.5.1.1. The code is UTC, so a code without its optional `Z` is still read
 *   as UTC, never as a local time.
 * - Years 0001 to 9999, leading zeros in every field, upper-case `T` and `Z`, and `.` as the
 *   only decimal sign.
 * - The seconds must be present. A shorter subset such as `2024-06-15` or `2024-06-15T10:30`
 *   returns "", because it names a span of time, not an instant.
 * - The fraction keeps the digits as sent, trailing zeros included. Digits after the ninth are
 *   dropped, never rounded, because Temporal holds nanoseconds.
 * - A second of 60 is read only at one of the 27 inserted leap seconds (IERS table built into
 *   GMT) and is returned as `…T23:59:60Z`.
 *
 * @param value CCSDS ASCII Time Code A text
 * @returns the instant as `YYYY-MM-DDThh:mm:ss[.f]Z`, or "" when `value` is not a Code A time
 *
 * @example parseCcsdsAsciiA("1988-01-18T17:20:43.123456Z") // "1988-01-18T17:20:43.123456Z" — CCSDS's own example
 * @example parseCcsdsAsciiA("2024-06-15T10:30:00") // "2024-06-15T10:30:00Z" — the Z is optional
 * @example parseCcsdsAsciiA("2016-12-31T23:59:60Z") // "2016-12-31T23:59:60Z" — the inserted second
 * @example parseCcsdsAsciiA("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example parseCcsdsAsciiA("2024-06-15") // "" — a day, not an instant
 */
export function parseCcsdsAsciiA(value: string): string {
  try {
    const fields = readCcsdsAsciiA(value);
    if (fields === null) {
      return "";
    }
    const date = Temporal.PlainDate.from(
      { year: fields.year, month: fields.month, day: fields.day },
      { overflow: "reject" },
    );
    return ccsdsInstantText(date, fields);
  } catch {
    return "";
  }
}
