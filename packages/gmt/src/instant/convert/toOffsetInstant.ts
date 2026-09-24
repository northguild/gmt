import { Temporal } from "@js-temporal/polyfill";
import {
  formatUtcOffset,
  isoStringBody,
  parseInstantNanoseconds,
  TIME_ZONE_ANNOTATION,
  zonedDateTimeFrom,
} from "../../internal";
import { utcOffset } from "../../regex";
import { isValidTimeZone } from "../../zoned/validate";

/** A leading RFC 9557 time zone annotation: `[zone]` or `[!zone]`, with no `=`. */
const timeZoneAnnotation = new RegExp(`^${TIME_ZONE_ANNOTATION}`);

/**
 * An absolute instant paired with the local UTC offset in force where the event happened.
 *
 * @remarks Members:
 *
 * | Member | Type | Description |
 * | --- | --- | --- |
 * | `instant` | `string` | UTC instant, ISO 8601 ending in `Z` (e.g. `2024-07-15T16:00:00Z`). Orders events globally. |
 * | `offset` | `string` | UTC offset in force where the event happened, `±HH:MM` (or `±HH:MM:SS` for a pre-1972 zone that did not run on a whole minute). Renders the event as the human on the ground saw it. |
 * | `timeZone` | `string \| undefined` | IANA zone identifier, when one is known. Absent from most feeds, so absent from most pairs. |
 *
 * Neither `instant` nor `offset` derives from the other, which is why both are stored. It is
 * the shape GS1 EPCIS 2.0 (`eventTime` + a required `eventTimeZoneOffset`), UN/EDIFACT DTM
 * (qualifier `303`/`304`) and DICOM (`DT` + `&ZZXX`) all exchange.
 *
 * @example
 * import { OffsetInstant } from "@northguild/gmt/instant";
 * const pair: OffsetInstant = {
 *   instant: "2024-07-15T16:00:00Z",
 *   offset: "-04:00",
 *   timeZone: "America/New_York",
 * };
 */
export interface OffsetInstant {
  instant: string;
  offset: string;
  timeZone?: string;
}

/**
 * Split an ISO 8601 instant string into the instant-plus-offset pair the world exchanges.
 *
 * - **An offset is not a zone.** `-05:00` does not identify `America/New_York` — it is every
 *   zone at `-05:00` that day. Keep the offset for what already happened; keep the zone for
 *   anything still to be scheduled. `timeZone` is optional because most feeds send no zone.
 * - Accepts a `Z` instant, a bare `±HH:MM` offset, or a bracketed IANA zone, in ISO 8601
 *   extended format with a `T` separator — `isValidInstant`'s grammar. Basic format, a space or
 *   lower-case `t` separator and a lower-case `z` return null. RFC 9557
 *   annotations are read as Temporal reads them (RFC 9557 §3.3, proposal-temporal
 *   `ParseISODateTime`): a calendar (`[u-ca=hebrew]`) or elective (`[x-provenance=estimated]`)
 *   annotation is ignored, and an unknown critical one (`[!foo=bar]`) returns null.
 * - A bracketed zone whose offset contradicts it (`"...T12:00:00-05:00[America/New_York]"` in
 *   July) returns null. The string states two things that cannot both be true, and guessing
 *   which one the sender meant is exactly the bug the pair exists to prevent.
 * - A bracketed *offset* time zone (Temporal's own `[-04:00]` shape) yields no `timeZone`
 *   field. It names no place, so filling the field with it would claim GMT knows where the
 *   event happened when all it has is the offset it already stores. Every other bracketed
 *   identifier Temporal accepts is kept, including the single-component IANA names (`EST5EDT`,
 *   `Zulu`), in its IANA casing.
 * - `timeZone` names the zone the offset is read in, and is how a UTC-only feed gets a pair
 *   with a local offset. It also overrides a zone bracketed in the string — the instant is
 *   unchanged either way, only the local rendering differs. It is validated with
 *   `isValidTimeZone`, so any IANA Zone or Link name is accepted, single-component ones
 *   (`Japan`, `Zulu`, `EST5EDT`) included. An offset identifier (`"-05:00"`) sets the offset
 *   and, like a bracketed offset zone, yields no `timeZone` field.
 * - The returned `timeZone` is the identifier in its IANA casing on every path —
 *   `"america/new_york"` comes back as `"America/New_York"` — because identifiers match
 *   case-insensitively (ECMA-402). That is what the bracket path and `fromOffsetInstant` return,
 *   so `toOffsetInstant(fromOffsetInstant(pair))` returns `pair`. A link name is kept, not
 *   replaced by its target. Compatibility: earlier releases echoed the argument's casing; pass
 *   the IANA-cased identifier to get the same string back.
 * - A `Z` (or RFC 3339 `-00:00`) instant is recorded with offset `+00:00`. RFC 9557 §2.2 reads
 *   `Z` and `-00:00` as "UTC known, local offset unknown", which differs from an explicit
 *   `+00:00`; the pair has no spelling for an unknown offset, so that distinction is not kept.
 * - An offset with fractional seconds (`+01:00:00.5`), which `isValidInstant` accepts, returns
 *   null: `offset` holds at most `±HH:MM:SS`.
 * - `offset` is `±HH:MM`, except for the handful of zones that did not run on a whole minute
 *   before 1972, where it is `±HH:MM:SS` — `Africa/Monrovia` really was `-00:44:30`, and
 *   rounding it would put the pair 30 seconds from the event it describes. Such a zone's
 *   *string* still carries the rounded `-00:45`, because RFC 9557 caps a written offset at
 *   minutes; the bracketed zone is what resolves it, so the instant stays exact.
 * - Returns null on invalid input, not a zero-offset pair — `+00:00` is a real offset.
 *
 * @param value ISO 8601 instant string, with an offset designator and optionally a bracketed zone
 * @param timeZone optional IANA zone identifier to read the offset in
 * @returns `{ instant, offset, timeZone? }`, or null on invalid input
 *
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[America/New_York]") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — an offset with no zone behind it
 * @example toOffsetInstant("2024-07-15T16:00:00Z") // { instant: "2024-07-15T16:00:00Z", offset: "+00:00" }
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "America/New_York") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }
 * @example toOffsetInstant("2024-01-15T17:00:00Z", "America/New_York") // { instant: "2024-01-15T17:00:00Z", offset: "-05:00", timeZone: "America/New_York" } — same wall time, different offset, six months apart
 * @example toOffsetInstant("1970-01-01T00:00:00Z", "Africa/Monrovia") // { instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" }
 * @example toOffsetInstant("1969-12-31T23:15:30-00:45[Africa/Monrovia]") // { instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" } — the zone, not the rounded offset, fixes the instant
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[-04:00]") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — a bracketed offset is not a zone, so no timeZone field
 * @example toOffsetInstant("2024-07-15T12:00:00-05:00[America/New_York]") // null (offset contradicts the bracketed zone)
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[foo=bar]") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — an elective annotation is ignored
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[!foo=bar]") // null (an unknown critical annotation)
 * @example toOffsetInstant("2024-07-15T12:00:00") // null (no offset designator)
 * @example toOffsetInstant("20240715T120000-0400") // null (basic format)
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "america/new_york") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" } — IANA casing
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Japan") // { instant: "2024-07-15T16:00:00Z", offset: "+09:00", timeZone: "Japan" }
 * @example toOffsetInstant("2024-07-15T16:00:00-00:00") // { instant: "2024-07-15T16:00:00Z", offset: "+00:00" } — "offset unknown" is not preserved
 * @example toOffsetInstant("2024-07-15T16:00:00+01:00:00.5") // null (fractional-second offset)
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Invalid/Zone") // null
 */
export function toOffsetInstant(
  value: string,
  timeZone?: string,
): OffsetInstant | null {
  const epochNanoseconds = parseInstantNanoseconds(value);

  if (epochNanoseconds === null) {
    return null;
  }

  if (timeZone !== undefined && !isValidTimeZone(timeZone)) {
    return null;
  }

  try {
    // `parseInstantNanoseconds` reads the offset and ignores the bracket, so a self-
    // contradictory string parses fine as an instant. `ZonedDateTime.from` is what checks
    // the two agree, and it runs even when `timeZone` overrides the bracketed zone.
    // Only a time zone annotation makes the string zoned: it is the first annotation, and the
    // only kind with no `=` (RFC 9557 §4.1). A calendar or elective annotation alone leaves an
    // offset-only instant.
    const body = isoStringBody(value);
    const bracketed = timeZoneAnnotation.test(value.slice(body.length))
      ? zonedDateTimeFrom(value)
      : null;

    // Temporal also accepts a bracketed *offset* time zone (`[-04:00]`), and canonicalises
    // every spelling of one (`[-0400]`, `[+05]`) to `±HH:MM`. That names no place and must
    // not reach the `timeZone` field, which would then claim GMT knows where the event
    // happened when all it has is the offset it already stores. The test is for an offset
    // because that is the one kind of bracketed identifier to drop; Temporal has already
    // validated every other one as part of the string.
    const bracketedZone =
      bracketed !== null && !utcOffset.test(bracketed.timeZoneId)
        ? bracketed.timeZoneId
        : undefined;

    // Where a bracket is present, Temporal's own resolution is the authority on the
    // instant, not `Temporal.Instant.from`'s literal reading of the offset. For a zone that
    // did not run on a whole minute the two disagree: RFC 9557 caps a string's offset at
    // minutes, so `Africa/Monrovia` writes `-00:45` for a real `-00:44:30`, and reading
    // that literally lands 30 seconds late. `ZonedDateTime.from` resolves the rounded
    // offset against the zone's true one. For every other zone the two agree exactly, and a
    // mismatched offset has already thrown.
    const instant =
      bracketed !== null
        ? bracketed.toInstant()
        : Temporal.Instant.fromEpochNanoseconds(epochNanoseconds);

    const resolvedZone = timeZone ?? bracketedZone;

    if (resolvedZone !== undefined) {
      return offsetInstantInZone(instant, resolvedZone);
    }

    // No zone, so the only offset on record is the one written in the string — and with a
    // bracket present Temporal has already read it.
    if (bracketed !== null) {
      return { instant: instant.toString(), offset: bracketed.offset };
    }

    const offset = writtenOffset(instant, body);
    return offset === null ? null : { instant: instant.toString(), offset };
  } catch {
    return null;
  }
}

/** The pair read in `zone`; an offset zone names no place, so it fills no `timeZone` field. */
function offsetInstantInZone(
  instant: Temporal.Instant,
  zone: string,
): OffsetInstant {
  // `timeZoneId` is the identifier in its IANA casing (ECMA-402
  // GetAvailableNamedTimeZoneIdentifier matches case-insensitively and returns the database's
  // spelling), which is what the bracket path and `fromOffsetInstant` already return. A link
  // name stays a link name: `Asia/Calcutta` is not rewritten to `Asia/Kolkata`.
  const zoned = instant.toZonedDateTimeISO(zone);

  // An offset `timeZone` (`"-05:00"`, canonicalised by Temporal) sets the offset like a
  // bracketed offset zone does and, naming no place, fills no `timeZone` field.
  if (utcOffset.test(zoned.timeZoneId)) {
    return { instant: instant.toString(), offset: zoned.offset };
  }

  return {
    instant: instant.toString(),
    offset: zoned.offset,
    timeZone: zoned.timeZoneId,
  };
}

/** The offset the string's own digits were written in, recovered for an unbracketed value. */
function writtenOffset(instant: Temporal.Instant, body: string): string | null {
  // With no zone and no bracket, the offset is the distance between two wall clocks: the digits as
  // written, and the same instant read in UTC. That recovers it without slicing the
  // string. The subtraction stays on `PlainDateTime` rather than going through an
  // instant, because a wall clock reaches a day further either side than an instant does
  // — `+275760-09-13T14:00:00+14:00` names a representable instant whose digits, read as
  // UTC, are past the end of the range. `PlainDateTime.from` parses every shape this
  // grammar allows but the `Z` designator, and a `Z` string's wall clock *is* the UTC
  // one, so its offset is `+00:00` by definition.
  const utcWallClock = instant.toZonedDateTimeISO("UTC").toPlainDateTime();
  const writtenWallClock =
    body.endsWith("Z") || body.endsWith("z")
      ? utcWallClock
      : Temporal.PlainDateTime.from(body);
  return formatUtcOffset(
    BigInt(
      utcWallClock.until(writtenWallClock, { largestUnit: "nanosecond" })
        .nanoseconds,
    ),
  );
}
