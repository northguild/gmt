import { Temporal } from "@js-temporal/polyfill";
import { isoStringBody } from "../../internal/isoStringBody";
import { plainTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Return true when `value` is a valid ISO PlainTime string.
 *
 * - The part before the first annotation must match `plainTime`.
 * - Reads RFC 9557 annotations as `Temporal.PlainTime.from` does: elective ones (`[foo=bar]`), a
 *   time zone annotation and a calendar annotation are ignored (a time has no calendar), and an
 *   unknown critical one (`[!foo=bar]`) is rejected.
 * - Rejects leap seconds (e.g., "23:59:60").
 * - Rejects invalid times (e.g., "24:00:00", "23:60:00").
 *
 * @param value ISO PlainTime string
 * @returns boolean indicating validity
 *
 * @example isValidTime("12:34:56") // true
 * @example isValidTime("24:00:00") // false (invalid hour)
 * @example isValidTime("12:34:56[u-ca=hebrew]") // true (calendar annotation ignored)
 * @example isValidTime("12:34:56[!foo=bar]") // false (unknown critical annotation)
 * @example isValidTime("23:60:00") // false (invalid minute)
 * @example isValidTime("23:59:60") // false (leap second)
 */
export function isValidTime(value: string): boolean {
  const body = isoStringBody(value);

  if (isLeapSecond(body)) {
    return false;
  }

  if (!plainTime.test(body)) {
    return false;
  }

  try {
    Temporal.PlainTime.from(value);
    return true;
  } catch {
    return false;
  }
}
