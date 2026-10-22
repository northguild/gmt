import { Temporal } from "../../internal/temporal";
import {
  formatUtcOffset,
  isoStringBody,
  isWithinIsoDaysRange,
  TIME_ZONE_ANNOTATION,
  UTC_OFFSET_WITH_SECONDS,
  writtenOffset,
  zonedDateTimeFrom,
} from "../../internal";
import { classifyWall } from "../../internal/earlierOccurrence";
import {
  hasInstantShape,
  hasZonedDateTimeShape,
} from "../../internal/isoStringBody";
import { hasSecond60 } from "../../plain/validate/hasSecond60";
import { utcOffset } from "../../regex";
import type { StoredZonedClassification } from "../../types";

/** A leading RFC 9557 time zone annotation: `[zone]` or `[!zone]`, with no `=`. */
const timeZoneAnnotation = new RegExp(`^${TIME_ZONE_ANNOTATION}`);

/**
 * Says whether a stored RFC 9557 string with both an offset and a zone still names one
 * instant under this host's time zone rules, and gives every reading when it does not.
 *
 * An offset stored next to a zone is a claim about the zone's rules. When the rules change
 * after the string was written, the offset and the zone can disagree (RFC 9557 §3.4), or the
 * local time can fall into a new gap or overlap. Each of Temporal's `offset` values
 * (`use`, `ignore`, `prefer`, `reject`) is one choice among the readings returned.
 *
 * Resolution: none. No reading is chosen. An ambiguous or nonexistent local time returns both
 * its `earlier` and `later` readings, as `disambiguation` names them, and the instant the
 * stored offset gives.
 *
 * - Five kinds. `valid`: the local time occurs once, at the stored offset. `validInOverlap`: it
 *   occurs twice and the stored offset picks `instant`, which is `earlier` or `later`.
 *   `offsetMismatch`: it occurs once, but not at the stored offset. `ambiguous`: it occurs
 *   twice and the stored offset picks neither. `nonexistent`: it falls in a gap.
 * - Every kind carries `atStoredOffset`, the instant `offset: "use"` gives. It differs from
 *   `instant` when an offset written to the minute matches a zone offset with seconds
 *   (`Africa/Monrovia`, `-00:45` for `-00:44:30`). An offset written with seconds must match
 *   exactly.
 * - Each reading is a `Temporal.Instant#toString` string ending in `Z`, and each offset is
 *   `±HH:MM[:SS]`. `storedOffset` keeps the seconds as written, so `-00:45:00` stays
 *   `-00:45:00`; `zoneOffset` drops a zero seconds part.
 * - The result depends on the host's tzdb: the same string can be `valid` on one host and
 *   `offsetMismatch` on another. On Node, `process.versions.tz` names the release. Browsers
 *   expose no equivalent.
 * - `…Z[zone]` is always `valid` (Temporal reads `Z` as exact, RFC 9557 §3.4 Figure 2), even
 *   inside an overlap or a gap. `-00:00` is a numeric offset of zero, as Temporal reads it,
 *   so it can be an `offsetMismatch`.
 * - Returns null for a string with no offset, no zone annotation, a bracketed offset in place
 *   of an IANA zone, an unknown zone, an offset finer than a second, a calendar other than
 *   `iso8601`, second 60, basic format, a reading outside the instant range, a local date of
 *   `-271821-04-19` (which Temporal's `prefer` and `reject` refuse), or any non-string input.
 *
 * @param value RFC 9557 string with a UTC offset and a bracketed IANA time zone
 * @returns the classification with every reading as a `Z` instant string, or `null` for any
 *   other input
 *
 * @example classifyStoredZoned("2016-12-01T09:00:00+02:00[Europe/Istanbul]") // { kind: "offsetMismatch", storedOffset: "+02:00", zoneOffset: "+03:00", atStoredOffset: "2016-12-01T07:00:00Z", atZoneOffset: "2016-12-01T06:00:00Z" }
 * @example classifyStoredZoned("2026-03-29T01:30:00+00:00[Europe/London]") // { kind: "nonexistent", earlier: "2026-03-29T00:30:00Z", later: "2026-03-29T01:30:00Z", atStoredOffset: "2026-03-29T01:30:00Z" }
 * @example classifyStoredZoned("2026-10-25T01:30:00+01:00[Europe/London]") // { kind: "validInOverlap", instant: "2026-10-25T00:30:00Z", earlier: "2026-10-25T00:30:00Z", later: "2026-10-25T01:30:00Z", atStoredOffset: "2026-10-25T00:30:00Z" }
 * @example classifyStoredZoned("2026-03-29T01:30:00[Europe/London]") // null
 */
export function classifyStoredZoned(
  value: string,
): StoredZonedClassification | null {
  if (
    typeof value !== "string" ||
    hasSecond60(value) ||
    !hasZonedDateTimeShape(value) ||
    !hasInstantShape(value)
  ) {
    return null;
  }

  try {
    return classifyShaped(value);
  } catch {
    return null;
  }
}

/**
 * A `Z` string. It is offsetBehaviour exact (Temporal §6.5.2): no candidate is checked, so the
 * exact read is the whole answer. It also keeps `Z` strings at the instant-range edge, where an
 * `ignore` read would resolve the zone's wall clock outside the range.
 */
function classifyExact(value: string): StoredZonedClassification | null {
  const exact = zonedDateTimeFrom(value);

  // A bracketed offset names no place, and Temporal accepts it; GMT does not.
  if (utcOffset.test(exact.timeZoneId) || exact.calendarId !== "iso8601") {
    return null;
  }

  const instant = exact.toInstant().toString();
  return { kind: "valid", instant, atStoredOffset: instant };
}

/**
 * The offset as written: `writtenOffset` drops a seconds part of zero, so `-00:45:00` is put back
 * when the body wrote seconds. Without it a caller could not tell `-00:45:00` (which must match
 * the zone exactly) from `-00:45` (which may match `-00:44:30`).
 */
function withWrittenSeconds(
  offset: string | null,
  body: string,
): string | null {
  return offset !== null &&
    offset.length === 6 &&
    UTC_OFFSET_WITH_SECONDS.test(body)
    ? `${offset}:00`
    : offset;
}

/** What the stored offset says, or null when it cannot be trusted. */
function readStored(
  value: string,
  body: string,
): {
  use: Temporal.Instant;
  storedOffset: string;
  wall: Temporal.PlainDateTime;
} | null {
  const use = zonedDateTimeFrom(value, { offset: "use" }).toInstant();
  const storedOffset = withWrittenSeconds(writtenOffset(use, body), body);
  const wall = Temporal.PlainDateTime.from(body);

  // Temporal's `prefer` and `reject` refuse a local date outside CheckISODaysRange (§6.5.1
  // step 7), so the stored offset cannot be checked and the string is not a valid stored time.
  // `use` accepts that date. TC39's `ignore` accepts it too, but polyfill 0.5.1 throws there, so
  // the `ignore` read in `classifyShaped` can throw first; `classifyStoredZoned` catches that and
  // returns the same null.
  return storedOffset === null || !isWithinIsoDaysRange(wall)
    ? null
    : { use, storedOffset, wall };
}

/** The classification of a string that passed the shape gate; throws where Temporal throws. */
function classifyShaped(value: string): StoredZonedClassification | null {
  const body = isoStringBody(value);

  // Only a time zone annotation makes the string zoned (RFC 9557 §4.1).
  if (!timeZoneAnnotation.test(value.slice(body.length))) {
    return null;
  }

  if (body.endsWith("Z") || body.endsWith("z")) {
    return classifyExact(value);
  }

  const zoned = zonedDateTimeFrom(value, { offset: "ignore" });

  // A bracketed offset names no place, and Temporal accepts it; GMT does not.
  if (utcOffset.test(zoned.timeZoneId) || zoned.calendarId !== "iso8601") {
    return null;
  }

  const stored = readStored(value, body);

  if (stored === null) {
    return null;
  }

  const { use, storedOffset, wall } = stored;

  const { kind, earliest, latest } = classifyWall(wall, zoned.timeZoneId);
  const readings = {
    earlier: earliest.toInstant().toString(),
    later: latest.toInstant().toString(),
    atStoredOffset: use.toString(),
  };

  if (kind === "nonexistent") {
    return { kind, ...readings };
  }

  // `reject` is Temporal §6.5.1: the stored offset must match a candidate instant.
  const matched = matchStoredOffset(value);

  if (kind === "ambiguous") {
    return classifyOverlap(matched, readings);
  }

  return classifyUnique(matched, readings, storedOffset, earliest);
}

/** A repeated wall clock: valid in the overlap when the stored offset picks one of its readings. */
function classifyOverlap(
  matched: string | null,
  readings: { earlier: string; later: string; atStoredOffset: string },
): StoredZonedClassification {
  return matched === null
    ? { kind: "ambiguous", ...readings }
    : { kind: "validInOverlap", instant: matched, ...readings };
}

/** A wall clock with one reading: valid when the stored offset matches it, otherwise a mismatch. */
function classifyUnique(
  matched: string | null,
  readings: { earlier: string; atStoredOffset: string },
  storedOffset: string,
  earliest: Temporal.ZonedDateTime,
): StoredZonedClassification | null {
  if (matched !== null) {
    return {
      kind: "valid",
      instant: matched,
      atStoredOffset: readings.atStoredOffset,
    };
  }

  const zoneOffset = formatUtcOffset(BigInt(earliest.offsetNanoseconds));

  return zoneOffset === null
    ? null
    : {
        kind: "offsetMismatch",
        storedOffset,
        zoneOffset,
        atStoredOffset: readings.atStoredOffset,
        atZoneOffset: readings.earlier,
      };
}

/** The instant the stored offset picks under `offset: "reject"`, or null when nothing matches. */
function matchStoredOffset(value: string): string | null {
  try {
    return zonedDateTimeFrom(value).toInstant().toString();
  } catch {
    return null;
  }
}
