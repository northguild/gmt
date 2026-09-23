import { Temporal } from "@js-temporal/polyfill";
import { isoStringBody } from "../../internal/isoStringBody";
import { isLeapSecond } from "../../plain/validate";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when the provided string is a valid ISO 8601 UTC datetime.
 *
 * - The part before the first annotation must match `utcDateTime` (`<date>T<time>Z`): ISO 8601
 *   extended format with an upper-case `Z`, so `z`, a `t` or space separator and basic format fail.
 * - Reads RFC 9557 annotations as `Temporal.Instant.from` does: elective ones (`[foo=bar]`), a
 *   time zone annotation and a calendar annotation are ignored (an instant has neither), and an
 *   unknown critical one (`[!foo=bar]`) is rejected.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60Z").
 * - Uses Temporal.Instant.from for validation.
 * - Requires a time component — date-only strings ("2024-01-01Z") are rejected.
 *
 * @param value input UTC datetime string (ISO 8601)
 * @returns boolean indicating whether the input is a valid UTC datetime
 *
 * @example isValidUtc("2024-03-17T14:30:45Z") // true
 * @example isValidUtc("2024-01-01Z") // false — date-only not supported
 * @example isValidUtc("2024-03-17T14:30:45z") // false — lower-case z (ISO 8601 extended format only)
 * @example isValidUtc("2024-03-17T14:30:45Z[Europe/Paris]") // true — the annotation is ignored
 * @example isValidUtc("2024-03-17T14:30:45Z[!foo=bar]") // false — unknown critical annotation
 * @example isValidUtc("2024-12-31T23:59:60Z") // false
 * @example isValidUtc("invalid") // false
 */
export function isValidUtc(value: string): boolean {
  const body = isoStringBody(value);

  if (isLeapSecond(body)) {
    return false;
  }

  if (!utcDateTime.test(body)) {
    return false;
  }

  try {
    Temporal.Instant.from(value);
    return true;
  } catch {
    return false;
  }
}
