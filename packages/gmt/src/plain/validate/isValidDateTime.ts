import { Temporal } from "@js-temporal/polyfill";
import { isoStringBody } from "../../internal/isoStringBody";
import { plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid PlainDateTime string.
 *
 * - The part before the first annotation must match `plainDateTime`.
 * - Reads RFC 9557 annotations as `Temporal.PlainDateTime.from` does: elective ones
 *   (`[foo=bar]`) and a time zone annotation are ignored, and an unknown critical one
 *   (`[!foo=bar]`) is rejected. The calendar must be ISO (`[u-ca=iso8601]` is accepted).
 * - Rejects leap seconds (e.g., "2024-02-29T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30") and invalid times (e.g., "2024-02-29T24:00:00").
 *
 * @param value string candidate
 * @returns boolean indicating whether the value is a valid PlainDateTime string
 *
 * @example isValidDateTime("2024-02-29T12:34:56") // true
 * @example isValidDateTime("2024-02-30T12:34:56") // false (invalid date)
 * @example isValidDateTime("2024-02-29T12:34:56[America/New_York]") // true (time zone annotation ignored)
 * @example isValidDateTime("2024-02-29T12:34:56[!foo=bar]") // false (unknown critical annotation)
 * @example isValidDateTime("2024-02-29T12:34:56[u-ca=hebrew]") // false (non-ISO calendar)
 * @example isValidDateTime("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidDateTime("2024-02-29T23:59:60") // false (leap second)
 */
export function isValidDateTime(value: string): boolean {
  const body = isoStringBody(value);

  if (isLeapSecond(body)) {
    return false;
  }

  if (!plainDateTime.test(body)) {
    return false;
  }

  try {
    return Temporal.PlainDateTime.from(value).calendarId === "iso8601";
  } catch {
    return false;
  }
}
