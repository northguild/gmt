import { Temporal } from "../../internal/temporal";
import { isoStringBody } from "../../internal/isoStringBody";
import { hasSecond60 } from "../../plain/validate";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when the provided string is a valid ISO 8601 UTC datetime.
 *
 * - The part before the first annotation must match `utcDateTime` (`<date>T<time>Z`): ISO 8601
 *   extended format with an upper-case `Z`, so `z`, a `t` or space separator and basic format fail.
 * - Reads RFC 9557 annotations as `Temporal.Instant.from` does: elective ones (`[foo=bar]`), a
 *   time zone annotation and a calendar annotation are ignored (an instant has neither), and an
 *   unknown critical one (`[!foo=bar]`) is rejected.
 * - Accepts four forms beyond the timestamp shape `YYYY-MM-DDTHH:MM:SS[.f]Z`: a time without
 *   seconds, a comma before the fraction, an expanded `±YYYYYY` year and RFC 9557 annotations.
 *   For the plain RFC 3339 spelling that readers other than Temporal expect, use
 *   `isValidUtcTimestamp`, which is false for all four.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60Z").
 * - Uses Temporal.Instant.from for validation.
 * - Requires a time component — date-only strings ("2024-01-01Z") are rejected.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO 8601 UTC datetime
 * @returns boolean indicating whether the input is a valid UTC datetime
 *
 * @example isValidUtc("2024-03-17T14:30:45Z") // true
 * @example isValidUtc("2024-01-01Z") // false — date-only not supported
 * @example isValidUtc("2024-03-17T14:30:45z") // false — lower-case z (ISO 8601 extended format only)
 * @example isValidUtc("2024-03-17T14:30:45Z[Europe/Paris]") // true — the annotation is ignored
 * @example isValidUtc("2024-03-17T14:30:45Z[!foo=bar]") // false — unknown critical annotation
 * @example isValidUtc("2024-12-31T23:59:60Z") // false
 * @example isValidUtc("invalid") // false
 * @example isValidUtc(null) // false
 */
export function isValidUtc(value: string): boolean;
export function isValidUtc(value: {} | null | undefined | void): boolean;
export function isValidUtc(value: unknown): value is string;
export function isValidUtc(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const body = isoStringBody(value);

  if (hasSecond60(body)) {
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
