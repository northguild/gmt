import { Temporal } from "@js-temporal/polyfill";
import {
  EXTENDED_UTC_OFFSET,
  TIME_ZONE_ANNOTATION,
  utcOffsetStringNanoseconds,
  wallClockAtOffset,
  zonedDateTimeFrom,
} from "../../internal";
import { isValidDuration } from "../../duration/validate/isValidDuration";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import { isValidZonedDateTime } from "../../zoned/validate/isValidZonedDateTime";

/**
 * Trailing `Z` or extended offset of an instant string, before any annotation. The offset grammar
 * is `isValidInstant`'s own (`EXTENDED_UTC_OFFSET`), so every offset it accepts, `,` fractions
 * included, is captured as written.
 */
const trailingOffset = new RegExp(
  `(Z|${EXTENDED_UTC_OFFSET})(?:\\[[^\\]]*\\])*$`,
);

/**
 * A time-zone annotation anywhere in the string (`TIME_ZONE_ANNOTATION`). Every `key=value`
 * bracket is a tagged annotation, which `isValidInstant` already decides.
 */
const zoneAnnotation = new RegExp(TIME_ZONE_ANNOTATION);

/**
 * Add a transit duration to a departure and return the arrival, in the departure's own zone.
 *
 * The first of the three shared transport operations: a leg is a departure plus how long it
 * takes. Every mode publishes it that way, and every mode gets the same thing wrong — a leg
 * that crosses a DST transition is a fixed number of *elapsed* hours, not a wall-clock
 * interval, so the local arrival time reflects the shift.
 *
 * - **Transit time is exact time.** Hours, minutes, seconds and fractions are added as elapsed
 *   time, and a day component means 24 hours, exactly. That is TC39 Temporal's rule:
 *   `Duration.prototype.round` and `total` without a `relativeTo` treat a day as 24 hours and
 *   require a `relativeTo` for weeks, months and years. A 26-hour leg that starts the evening
 *   before a spring-forward arrives at a wall time one hour later than a wall-clock reading would
 *   suggest, because that is when the vessel, train or aircraft actually gets there.
 * - **Calendar units are refused.** A `duration` with years, months or weeks returns `""`: no
 *   leg takes "a month" in a sense that time arithmetic can fix without a reference point, and
 *   Temporal will not add them to an instant either. Scheduled connections that are dated rather
 *   than timed belong to `scheduleDelivery`.
 * - **The departure's zone is preserved.** A bracketed IANA zone (`…-05:00[America/New_York]`)
 *   stays that zone, so the arrival's offset is whatever is in force there at arrival. A `Z`
 *   instant returns a `Z` instant; an offset-only instant keeps its offset, written exactly as
 *   the departure wrote it, sub-minute offsets such as `+05:30:15` included (an offset is not a
 *   zone, so nothing else can be inferred from it — see `toOffsetInstant`). A bracketed zone
 *   that does not exist, or that contradicts its offset, is rejected as `isValidZonedDateTime`
 *   rejects it; it does not fall back to the offset.
 * - RFC 9557 annotations are read as `Temporal.Instant.from` reads them: a bracket without `=`
 *   is a time zone, and a `key=value` bracket with an unknown key is ignored when elective and
 *   rejected when critical (`[!…]`). A calendar on a departure without a zone is accepted and
 *   changes nothing, since an instant has no calendar; a zoned departure's calendar must be ISO,
 *   as `isValidZonedDateTime` requires.
 * - A negative duration is allowed and moves backwards; that is how a departure is recovered
 *   from an arrival.
 * - Returns `""` when `departure` is not a zoned datetime or instant string, or `duration` is
 *   not an ISO 8601 duration.
 *
 * @param departure ISO 8601 zoned datetime (bracketed zone) or instant string (`Z` or offset)
 * @param duration ISO 8601 duration of the leg; time units and 24-hour days only
 * @returns the arrival in the departure's zone or offset form, or "" on invalid input
 *
 * @example transitTime("2024-06-15T10:00:00-04:00[America/New_York]", "PT2H30M") // "2024-06-15T12:30:00-04:00[America/New_York]"
 * @example transitTime("2024-03-09T23:00:00-05:00[America/New_York]", "PT4H") // "2024-03-10T04:00:00-04:00[America/New_York]" (four elapsed hours across the spring-forward, so the wall clock reads 04:00, not 03:00)
 * @example transitTime("2024-03-09T12:00:00-05:00[America/New_York]", "P1D") // "2024-03-10T13:00:00-04:00[America/New_York]" (a day is 24 elapsed hours, not "the same wall time tomorrow")
 * @example transitTime("2024-06-15T10:00:00Z", "PT36H") // "2024-06-16T22:00:00Z"
 * @example transitTime("2024-06-15T10:00:00+09:00", "PT1H") // "2024-06-15T11:00:00+09:00" (an offset stays an offset)
 * @example transitTime("2024-06-15T10:00:00+05:30:15", "PT1H") // "2024-06-15T11:00:00+05:30:15" (a sub-minute offset is kept as written)
 * @example transitTime("2024-06-15T10:00:00Z[foo=bar]", "PT1H") // "2024-06-15T11:00:00Z" (an elective unknown annotation is ignored)
 * @example transitTime("2024-06-15T12:30:00-04:00[America/New_York]", "-PT2H30M") // "2024-06-15T10:00:00-04:00[America/New_York]"
 * @example transitTime("2024-06-15T10:00:00-04:00[America/New_York]", "P1M") // "" (calendar units need a reference point)
 * @example transitTime("2024-06-15T10:00:00-05:00[America/New_York]", "PT2H") // "" (New York is -04:00 in June: the offset contradicts the zone)
 * @example transitTime("2024-06-15T10:00:00", "PT2H") // "" (no zone and no offset: not a moment)
 * @example transitTime("2024-06-15T10:00:00Z", "2 hours") // ""
 */
export function transitTime(departure: string, duration: string): string {
  // A non-string would reach the regex tests below, which coerce it: a throwing `toString`, a
  // Symbol or a hostile Proxy would escape. Refuse it before any read.
  if (typeof departure !== "string" || typeof duration !== "string") {
    return "";
  }

  try {
    return addLeg(departure, duration);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}

/** `transitTime` for two strings, without the guard. */
function addLeg(departure: string, duration: string): string {
  if (!isValidDuration(duration)) {
    return "";
  }

  const zoned = isValidZonedDateTime(departure);
  // A string that names a zone must name a real one that agrees with its offset; only a string
  // that names none may fall back to the instant path.
  if (
    !zoned &&
    (zoneAnnotation.test(departure) || !isValidInstant(departure))
  ) {
    return "";
  }

  try {
    const parsed = Temporal.Duration.from(duration);
    if (parsed.years !== 0 || parsed.months !== 0 || parsed.weeks !== 0) {
      return "";
    }
    // Days become 24 exact hours; every remaining unit is already exact time.
    const exact = parsed.round({ largestUnit: "hours" });

    if (zoned) {
      return zonedDateTimeFrom(departure).add(exact).toString();
    }

    const arrival = Temporal.Instant.from(departure).add(exact);
    const offset = trailingOffset.exec(departure)?.[1] ?? "Z";
    if (offset === "Z") {
      return arrival.toString();
    }
    // The arrival's wall clock in the departure's own offset, written with that offset's text.
    const wall = wallClockAtOffset(arrival, utcOffsetStringNanoseconds(offset));
    return `${wall.toString()}${offset}`;
  } catch {
    return "";
  }
}
