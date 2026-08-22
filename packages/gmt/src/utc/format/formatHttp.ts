import { Temporal } from "@js-temporal/polyfill";
import { ENGLISH_MONTH_NAMES, ENGLISH_WEEKDAY_NAMES } from "../../internal";
import { isValidUtc } from "../validate";

/**
 * Format a UTC ISO 8601 datetime string as an RFC 7231 IMF-fixdate — the
 * fixed grammar HTTP headers like `Last-Modified`/`Date`/`Expires` require.
 *
 * - **Fixed grammar, not a display format.** RFC 7231 mandates English
 *   weekday/month abbreviations and a literal `GMT` suffix regardless of
 *   caller locale — there is no locale-appropriate alternative ordering to
 *   lose (see roadmap `issues/J.md` Decision 1 / J13).
 * - Always `GMT`; HTTP-date carries no offset variation to preserve.
 * - Fractional seconds in `value` are truncated — IMF-fixdate has no
 *   sub-second field.
 * - Day, hour, minute, and second are always zero-padded to 2 digits; year
 *   is zero-padded to 4 digits.
 *
 * @param value UTC ISO 8601 datetime string (e.g. "2024-03-15T14:30:00Z")
 * @returns RFC 7231 IMF-fixdate string, or "" on invalid input
 *
 * @example formatHttp("2024-03-15T14:30:00Z") // "Fri, 15 Mar 2024 14:30:00 GMT"
 * @example formatHttp("2024-03-15T14:30:00.500Z") // "Fri, 15 Mar 2024 14:30:00 GMT"
 * @example formatHttp("invalid") // ""
 */
export function formatHttp(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const zdt = Temporal.Instant.from(value).toZonedDateTimeISO("UTC");

    const weekday = ENGLISH_WEEKDAY_NAMES[zdt.dayOfWeek - 1];
    const day = String(zdt.day).padStart(2, "0");
    const month = ENGLISH_MONTH_NAMES[zdt.month - 1];
    const year = String(zdt.year).padStart(4, "0");
    const hour = String(zdt.hour).padStart(2, "0");
    const minute = String(zdt.minute).padStart(2, "0");
    const second = String(zdt.second).padStart(2, "0");

    return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} GMT`;
  } catch {
    return "";
  }
}
