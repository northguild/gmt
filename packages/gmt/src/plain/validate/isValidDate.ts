import { Temporal } from "@js-temporal/polyfill";
import { isoStringBody } from "../../internal/isoStringBody";
import { plainDate } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true if `value` is a valid ISO PlainDate string.
 *
 * - The part before the first annotation must match `plainDate` (a date, not a date-time).
 * - Reads RFC 9557 annotations as `Temporal.PlainDate.from` does: elective ones (`[foo=bar]`)
 *   and a time zone annotation are ignored, and an unknown critical one (`[!foo=bar]`) is
 *   rejected. The calendar must be ISO (`[u-ca=iso8601]` is accepted); a non-ISO calendar is
 *   `isValidCalendarDate`'s input.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30").
 *
 * @param value ISO PlainDate string
 * @returns boolean indicating validity
 *
 * @example isValidDate("2024-03-10") // true
 * @example isValidDate("2024-02-30") // false
 * @example isValidDate("2024-03-10[u-ca=iso8601]") // true
 * @example isValidDate("2024-03-10[foo=bar]") // true (elective annotation ignored)
 * @example isValidDate("2024-03-10[!foo=bar]") // false (unknown critical annotation)
 * @example isValidDate("2024-03-10[u-ca=hebrew]") // false (use isValidCalendarDate)
 * @example isValidDate("invalid") // false
 * @example isValidDate("2024-12-31T23:59:60") // false (leap second - not a valid date)
 */
export function isValidDate(value: string): boolean {
  const body = isoStringBody(value);

  if (isLeapSecond(body)) {
    return false;
  }

  if (!plainDate.test(body)) {
    return false;
  }

  try {
    return Temporal.PlainDate.from(value).calendarId === "iso8601";
  } catch {
    return false;
  }
}
