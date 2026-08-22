import { Temporal } from "@js-temporal/polyfill";
import { rfc3339DateTime } from "../../regex";

/**
 * Parse a strict RFC 3339 datetime string into a zoned ISO 8601 datetime
 * string.
 *
 * - Accepts `T`, `t`, or a single space as the date/time separator (all
 *   three are valid RFC 3339, unlike GMT's own zoned strings which always
 *   use `T`) and either `Z`/`z` or a numeric `±HH:MM` offset.
 * - RFC 3339 carries no IANA zone name, so the parsed offset becomes the
 *   result's time zone identifier too (e.g. `Z` → `+00:00[+00:00]`) — the
 *   same fixed-offset-as-zone convention `parseRfc2822` uses.
 * - Rejects GMT's own bracketed zoned strings (`...+00:00[UTC]`) — that
 *   annotation is not valid RFC 3339 input; use `Temporal.ZonedDateTime.from`
 *   / `isValidZonedDateTime` directly for GMT's native format instead.
 *
 * @param value RFC 3339 datetime string (e.g. "2024-03-15T14:30:00-04:00")
 * @returns zoned ISO 8601 datetime string, or "" on invalid input
 *
 * @example parseRfc3339("2024-03-15T14:30:00-04:00") // "2024-03-15T14:30:00-04:00[-04:00]"
 * @example parseRfc3339("2024-03-15T14:30:00Z") // "2024-03-15T14:30:00+00:00[+00:00]"
 * @example parseRfc3339("2024-03-15T14:30:00+00:00[UTC]") // "" (bracket annotation not valid RFC 3339)
 * @example parseRfc3339("not a date") // ""
 */
export function parseRfc3339(value: string): string {
  if (typeof value !== "string") return "";

  const match = rfc3339DateTime.exec(value);
  if (match === null) return "";

  const [, year, month, day, hour, minute, second, fraction, offsetToken] =
    match;
  const offset =
    offsetToken === "Z" || offsetToken === "z" ? "+00:00" : offsetToken;
  const isoDateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction ?? ""}`;

  try {
    return Temporal.PlainDateTime.from(isoDateTime)
      .toZonedDateTime(offset)
      .toString();
  } catch {
    return "";
  }
}
