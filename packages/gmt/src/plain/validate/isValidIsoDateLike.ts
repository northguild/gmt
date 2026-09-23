import { Temporal } from "@js-temporal/polyfill";
import { isoStringBody } from "../../internal/isoStringBody";
import { plainDate, plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when the input is a valid PlainDate or PlainDateTime ISO string.
 *
 * - Accepts both PlainDate ("2024-02-29") and PlainDateTime ("2024-02-29T12:34:56") formats.
 * - The part before the first annotation must match `plainDate` or `plainDateTime`.
 * - Reads RFC 9557 annotations as `Temporal.PlainDate.from` / `Temporal.PlainDateTime.from` do:
 *   elective ones and a time zone annotation are ignored, an unknown critical one is rejected, and
 *   the calendar must be ISO.
 * - Rejects leap seconds and invalid dates/times.
 *
 * @param value ISO PlainDate or PlainDateTime string
 * @returns boolean indicating validity
 *
 * @example isValidIsoDateLike("2024-02-29") // true
 * @example isValidIsoDateLike("2024-02-30") // false (invalid date)
 * @example isValidIsoDateLike("2024-02-29T12:34:56") // true
 * @example isValidIsoDateLike("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidIsoDateLike("2024-12-31T23:59:60") // false (leap second)
 * @example isValidIsoDateLike("2024-02-29[u-ca=iso8601]") // true
 * @example isValidIsoDateLike("2024-02-29[u-ca=hebrew]") // false (non-ISO calendar)
 */
export function isValidIsoDateLike(value: string): boolean {
  const body = isoStringBody(value);

  if (isLeapSecond(body)) {
    return false;
  }

  if (plainDate.test(body)) {
    try {
      return Temporal.PlainDate.from(value).calendarId === "iso8601";
    } catch {
      return false;
    }
  }

  if (plainDateTime.test(body)) {
    try {
      return Temporal.PlainDateTime.from(value).calendarId === "iso8601";
    } catch {
      return false;
    }
  }

  return false;
}
