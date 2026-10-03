import { isValidDateTime } from "../../plain/validate";
import type { Disambiguation } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";
import { isoStringBody, zonedDateTimeFrom } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";
import { optionOrDefault } from "../../internal/optionOrDefault";

const DISAMBIGUATIONS: readonly string[] = [
  "compatible",
  "earlier",
  "later",
  "reject",
];

/**
 * Resolve a zoneless local wall time against an IANA zone and return the instant it names.
 *
 * Feeds deliver wall times with no offset all the time — "gate-out 08:00" — and turning one
 * into an instant takes a zone the sender did not send plus a policy for the two days a year
 * the mapping is not one-to-one. This states both.
 *
 * - Call `classifyLocal` first to find out whether the wall time is ambiguous or nonexistent
 *   before a `disambiguation` policy is applied.
 * - Returns a UTC instant, exactly — no rounding, so a nanosecond wall time survives. Pass it
 *   to `toOffsetInstant` for the offset pair, or reach for `convertPlainDateTimeToZoned` when
 *   what you want is the bracketed zoned string (it defaults to millisecond precision).
 * - `localDateTime` is a PlainDateTime string, as `isValidDateTime` accepts: `<date>T<time>`
 *   with no offset (an offset means the wall time already resolved). Its RFC 9557 annotations
 *   are read as `Temporal.PlainDateTime.from` reads them, so a time zone annotation
 *   (`[America/New_York]`) is ignored and `timeZone` alone resolves the wall time.
 * - Returns `""` on invalid input.
 *
 * @param localDateTime zoneless ISO 8601 local datetime string (e.g. "2024-11-03T01:30:00")
 * @param timeZone IANA name or UTC offset the wall time is read in
 * @param optionsArg How an ambiguous or nonexistent wall time is resolved
 * @returns UTC instant string ending in "Z", or "" on invalid input
 *
 * @example resolveLocal("2024-07-15T12:00:00", "America/New_York") // "2024-07-15T16:00:00Z"
 * @example resolveLocal("2024-11-03T01:30:00", "America/New_York") // "2024-11-03T05:30:00Z" (ambiguous; "compatible" takes the earlier)
 * @example resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" }) // "2024-11-03T06:30:00Z" (the same wall time, an hour later)
 * @example resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "reject" }) // "" (ambiguous, and not guessed)
 * @example resolveLocal("2024-03-10T02:30:00", "America/New_York") // "2024-03-10T07:30:00Z" (nonexistent; "compatible" takes the later)
 * @example resolveLocal("2024-03-10T02:30:00", "America/New_York", { disambiguation: "earlier" }) // "2024-03-10T06:30:00Z"
 * @example resolveLocal("2024-07-15T12:00:00-04:00", "America/New_York") // "" (not a zoneless wall time)
 * @example resolveLocal("2024-07-15T12:00:00[foo=bar]", "America/New_York") // "2024-07-15T16:00:00Z" (elective annotation ignored)
 * @example resolveLocal("2024-07-15T12:00:00", "Invalid/Zone") // ""
 */
export function resolveLocal(
  localDateTime: string,
  timeZone: string,
  optionsArg?: {
    /**
     * What happens when the wall time is ambiguous (a fall-back hour that happens twice) or
     * nonexistent (a spring-forward hour that never happens). `"compatible"` takes the earlier
     * instant of an ambiguous time and the later one of a nonexistent time, `"earlier"` and
     * `"later"` take that side in both cases, and `"reject"` returns `""` rather than resolving.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    const disambiguation = optionOrDefault(
      optionsArg?.disambiguation,
      "compatible",
    );

    if (
      !isValidDateTime(localDateTime) ||
      !isValidTimeZone(timeZone) ||
      !DISAMBIGUATIONS.includes(disambiguation)
    ) {
      return "";
    }

    try {
      return zonedDateTimeFrom(`${isoStringBody(localDateTime)}[${timeZone}]`, {
        disambiguation,
      })
        .toInstant()
        .toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
