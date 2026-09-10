import { Temporal } from "@js-temporal/polyfill";
import {
  formatUtcOffset,
  hasKeyValueAnnotation,
  parseInstantNanoseconds,
  parseUtcOffsetNanoseconds,
} from "../../internal";
import { utcOffset } from "../../regex";
import type { OffsetInstant } from "./toOffsetInstant";

/**
 * Render an instant-plus-offset pair back to the local time it describes.
 *
 * The inverse of `toOffsetInstant`: `toOffsetInstant(fromOffsetInstant(pair))` returns
 * `pair`, for zones with and without DST.
 *
 * - Without `timeZone`, returns `<date>T<time>±HH:MM` — the wall clock the event carried and
 *   the offset it carried it in, which is all an offset-only pair knows.
 * - With `timeZone`, returns the bracketed zoned string `<date>T<time>±HH:MM[Zone]`, so the
 *   zone survives the round trip instead of being silently dropped.
 * - A `timeZone` whose offset at `instant` is not `offset` returns `""`. The pair is stating
 *   two things that cannot both be true, and the whole point of carrying both fields is that
 *   a contradiction between them is visible.
 * - `timeZone` accepts every identifier Temporal does, as `toOffsetInstant`'s bracket does —
 *   including the slash-less IANA aliases (`EST5EDT`, `Zulu`). A `timeZone` that is really
 *   an offset (`"-04:00"`, or the `"-0400"`/`"+05"` spellings Temporal canonicalises to one)
 *   returns `""`: it names no place, and no pair `toOffsetInstant` produces carries one.
 * - `offset` is canonicalised, so `"+05:45:00"` renders as `+05:45` and `"-00:00"` as
 *   `+00:00`. `Z` is not an accepted offset — for an event that happened at UTC the pair's
 *   offset is `+00:00`.
 * - With a `timeZone`, a sub-minute offset is *written* rounded to the minute, because RFC
 *   9557 has no field for the seconds — `Africa/Monrovia`'s `-00:44:30` renders as `-00:45`.
 *   The bracketed zone is what resolves it, so the instant stays exact and the round trip
 *   returns `-00:44:30`. Without a `timeZone` there is no zone to resolve against, so the
 *   full `±HH:MM:SS` is written instead; that is ISO 8601, not RFC 9557.
 * - Returns `""` on invalid input.
 *
 * @param value `{ instant, offset, timeZone? }` pair, as produced by `toOffsetInstant`
 * @returns local ISO 8601 string carrying the pair's own offset, or "" on invalid input
 *
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }) // "2024-07-15T12:00:00-04:00"
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }) // "2024-07-15T12:00:00-04:00[America/New_York]"
 * @example fromOffsetInstant({ instant: "2024-11-03T05:30:00Z", offset: "-04:00", timeZone: "America/New_York" }) // "2024-11-03T01:30:00-04:00[America/New_York]" — the first 01:30 of the fall-back night
 * @example fromOffsetInstant({ instant: "2024-11-03T06:30:00Z", offset: "-05:00", timeZone: "America/New_York" }) // "2024-11-03T01:30:00-05:00[America/New_York]" — the second, an hour later
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "+00:00" }) // "2024-07-15T16:00:00+00:00"
 * @example fromOffsetInstant({ instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" }) // "1969-12-31T23:15:30-00:45[Africa/Monrovia]" — RFC 9557 rounds the written offset; the zone keeps the instant exact
 * @example fromOffsetInstant({ instant: "1970-01-01T00:00:00Z", offset: "-00:44:30" }) // "1969-12-31T23:15:30-00:44:30" — no zone to round against, so the seconds are written
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-05:00", timeZone: "America/New_York" }) // "" (offset contradicts the zone)
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "-04:00" }) // "" (an offset is not a zone)
 * @example fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "Z" }) // "" (a designator, not an offset)
 * @example fromOffsetInstant({ instant: "not an instant", offset: "-04:00" }) // ""
 */
export function fromOffsetInstant(value: OffsetInstant): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  const epochNanoseconds = parseInstantNanoseconds(value.instant);
  const offsetNanoseconds = parseUtcOffsetNanoseconds(value.offset);

  if (
    epochNanoseconds === null ||
    offsetNanoseconds === null ||
    hasKeyValueAnnotation(value.instant)
  ) {
    return "";
  }

  const offset = formatUtcOffset(offsetNanoseconds);

  if (offset === null) {
    return "";
  }

  try {
    const instant = Temporal.Instant.fromEpochNanoseconds(epochNanoseconds);

    if (value.timeZone !== undefined) {
      // Temporal is the authority on what identifier this is, exactly as it is for a
      // bracketed zone in `toOffsetInstant` — an unrecognised one throws, and the two
      // functions have to agree or a pair one produced would not survive the other. The
      // canonicalised id is what gets tested for an offset, since `"-0400"` and `"+05"` are
      // offsets too and only Temporal knows that.
      const zoned = instant.toZonedDateTimeISO(value.timeZone);

      if (utcOffset.test(zoned.timeZoneId)) {
        return "";
      }

      return zoned.offset === offset ? zoned.toString() : "";
    }

    // With no zone, the offset is the only thing that can shift the instant onto a wall
    // clock. The shift happens on the wall clock, never on the instant: `PlainDateTime`
    // reaches a day further either side than `Instant` does, so shifting the instant first
    // would reject the last 14 hours of the representable range — where a pair like
    // `{ "+275760-09-13T00:00:00Z", "+14:00" }` names a local time that exists. No offset
    // time zone is used either, since Temporal refuses to build one from a sub-minute
    // offset.
    const wallClock = instant
      .toZonedDateTimeISO("UTC")
      .toPlainDateTime()
      .add({ nanoseconds: Number(offsetNanoseconds) });

    return `${wallClock.toString()}${offset}`;
  } catch {
    return "";
  }
}
