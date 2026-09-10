import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * What a zoneless wall time turns out to be once a zone is attached to it.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `unique` | One instant. The ordinary case, and every case in a zone with no DST. |
 * | `ambiguous` | Two instants an offset shift apart — a fall-back hour the clock ran through twice. |
 * | `nonexistent` | No instant. A spring-forward hour the clock skipped, or a calendar day a zone deleted crossing the date line. |
 *
 * @example
 * import { LocalTimeClassification } from "@northguild/gmt/instant";
 * const kind: LocalTimeClassification = "ambiguous";
 */
export type LocalTimeClassification = "unique" | "ambiguous" | "nonexistent";

/**
 * Report whether a zoneless local wall time is unique, ambiguous or nonexistent in a zone —
 * before any policy resolves it.
 *
 * Ambiguous and nonexistent wall times are the single most common datetime bug there is:
 * 01:30 happens twice on a fall-back day and never on a spring-forward one. `resolveLocal`
 * will pick one for you; this exists so a demurrage clock, a medication window or a duty
 * limit can refuse instead, or route the case to a human, rather than silently accepting
 * whichever instant a default handed it.
 *
 * - Reads the zone's own transition table via `Temporal`, so it is right for every IANA zone
 *   and every year, including 30- and 45-minute shifts and zones that skipped a whole
 *   calendar day changing sides of the date line.
 * - `localDateTime` must be zoneless: `<date>T<time>`, as `isValidDateTime` accepts. A string
 *   that already carries an offset or a bracketed zone has no ambiguity left to report.
 * - Returns null on invalid input — never `"unique"`, which would read as a verdict.
 *
 * @param localDateTime zoneless ISO 8601 local datetime string (e.g. "2024-11-03T01:30:00")
 * @param timeZone IANA timeZone identifier the wall time is read in
 * @returns "unique" | "ambiguous" | "nonexistent", or null on invalid input
 *
 * @example classifyLocal("2024-07-15T12:00:00", "America/New_York") // "unique"
 * @example classifyLocal("2024-11-03T01:30:00", "America/New_York") // "ambiguous" (fall-back overlap)
 * @example classifyLocal("2024-03-10T02:30:00", "America/New_York") // "nonexistent" (spring-forward gap)
 * @example classifyLocal("2024-04-07T01:45:00", "Australia/Lord_Howe") // "ambiguous" (a 30-minute overlap)
 * @example classifyLocal("2024-09-29T03:15:00", "Pacific/Chatham") // "nonexistent" (a 45-minute-offset zone's gap)
 * @example classifyLocal("2011-12-30T12:00:00", "Pacific/Apia") // "nonexistent" (the day Samoa skipped crossing the date line)
 * @example classifyLocal("2024-11-03T01:30:00", "UTC") // "unique" (UTC has no transitions)
 * @example classifyLocal("2024-11-03T01:30:00-04:00", "America/New_York") // null (not a zoneless wall time)
 * @example classifyLocal("2024-11-03T01:30:00", "Invalid/Zone") // null
 */
export function classifyLocal(
  localDateTime: string,
  timeZone: string,
): LocalTimeClassification | null {
  if (!isValidDateTime(localDateTime) || !isValidTimeZone(timeZone)) {
    return null;
  }

  try {
    const wallClock = Temporal.PlainDateTime.from(localDateTime);
    const earliest = wallClock.toZonedDateTime(timeZone, {
      disambiguation: "earlier",
    });
    const latest = wallClock.toZonedDateTime(timeZone, {
      disambiguation: "later",
    });

    if (earliest.epochNanoseconds === latest.epochNanoseconds) {
      return "unique";
    }

    // Two instants, so the wall time is either repeated or skipped. Temporal separates them
    // the same way for both, and only the wall clock it lands on tells them apart: for an
    // overlap both instants read back as the requested time, and for a gap neither does —
    // "earlier"/"later" resolve a gap by moving off the requested time entirely.
    return earliest.toPlainDateTime().equals(wallClock)
      ? "ambiguous"
      : "nonexistent";
  } catch {
    return null;
  }
}
