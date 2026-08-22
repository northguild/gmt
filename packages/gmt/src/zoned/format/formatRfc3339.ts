import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Format a zoned ISO 8601 datetime string as strict RFC 3339 — the ISO 8601
 * *profile* RFC 3339 §5.6 defines, permitting only an explicit numeric
 * offset or `Z`, never a bracketed IANA zone name.
 *
 * - **Not a passthrough.** GMT's own zoned strings always carry a bracketed
 *   IANA zone annotation (e.g. `...+00:00[UTC]`) that plain
 *   `Temporal.ZonedDateTime.prototype.toString()` reproduces by default —
 *   that annotation is *not* valid RFC 3339. This function's only job is to
 *   strip it (`{ timeZoneName: "never" }`), which is exactly the detail a
 *   caller reaching for "give me RFC 3339" would otherwise miss. (Go/no-go
 *   recorded in roadmap `issues/J.md` J13: this narrow gap is real; a
 *   parallel `utc`/`unix` wrapper was *not* added, because
 *   `Temporal.Instant.prototype.toString()` is already fully RFC 3339
 *   compliant with no bracket to strip — that would be a pure passthrough.)
 *
 * @param value zoned ISO 8601 datetime string (e.g. "2024-03-15T14:30:00-04:00[America/New_York]")
 * @returns RFC 3339 datetime string, or "" on invalid input
 *
 * @example formatRfc3339("2024-03-15T14:30:00-04:00[America/New_York]") // "2024-03-15T14:30:00-04:00"
 * @example formatRfc3339("2024-03-15T14:30:00Z[UTC]") // "2024-03-15T14:30:00+00:00"
 * @example formatRfc3339("invalid") // ""
 */
export function formatRfc3339(value: string): string {
  if (!isValidZonedDateTime(value)) return "";

  try {
    return Temporal.ZonedDateTime.from(value).toString({
      timeZoneName: "never",
    });
  } catch {
    return "";
  }
}
