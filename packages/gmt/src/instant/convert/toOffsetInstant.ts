import { Temporal } from "@js-temporal/polyfill";
import {
  formatUtcOffset,
  hasKeyValueAnnotation,
  parseInstantNanoseconds,
} from "../../internal";
import { utcOffset } from "../../regex";
import { isValidTimeZone } from "../../zoned/validate";

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
 * - Accepts a `Z` instant, a bare `±HH:MM` offset, or a bracketed IANA zone, in extended or
 *   basic format, with a space or `T` separator — `isValidInstant`'s grammar, minus every
 *   RFC 9557 `[key=value]` annotation. `[u-ca=...]` is rejected library-wide; the rest are
 *   rejected here rather than silently dropped the way Temporal drops them, because an event
 *   tagged `[x-provenance=estimated]` is not the same fact as one without it.
 * - A bracketed zone whose offset contradicts it (`"...T12:00:00-05:00[America/New_York]"` in
 *   July) returns null. The string states two things that cannot both be true, and guessing
 *   which one the sender meant is exactly the bug the pair exists to prevent.
 * - A bracketed *offset* time zone (Temporal's own `[-04:00]` shape) yields no `timeZone`
 *   field. It names no place, so filling the field with it would claim GMT knows where the
 *   event happened when all it has is the offset it already stores. Every other bracketed
 *   identifier Temporal accepts is kept as written, including the slash-less IANA aliases
 *   (`EST5EDT`, `Zulu`) that the `timeZone` *argument* rejects — an argument is validated
 *   with `isValidTimeZone`, as every zone argument in GMT is, while a bracket is validated
 *   by Temporal as part of the string, as everywhere in `zoned/`.
 * - `timeZone` names the zone the offset is read in, and is how a UTC-only feed gets a pair
 *   with a local offset. It also overrides a zone bracketed in the string — the instant is
 *   unchanged either way, only the local rendering differs.
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
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[foo=bar]") // null (an annotation GMT cannot vouch for)
 * @example toOffsetInstant("2024-07-15T12:00:00") // null (no offset designator)
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Invalid/Zone") // null
 */
export function toOffsetInstant(
  value: string,
  timeZone?: string,
): OffsetInstant | null {
  const epochNanoseconds = parseInstantNanoseconds(value);

  // Stricter than `isValidInstant`, deliberately. That gate rejects only `[u-ca=...]`,
  // leaving every other RFC 9557 key-value annotation for Temporal to silently drop — the
  // right default for a parser and the wrong one here, where an event tagged
  // `[x-provenance=estimated]` is not the same fact as one without it and GMT has no way to
  // know that it is not. A bracketed zone carries no `=` and is unaffected.
  if (epochNanoseconds === null || hasKeyValueAnnotation(value)) {
    return null;
  }

  if (timeZone !== undefined && !isValidTimeZone(timeZone)) {
    return null;
  }

  try {
    // `parseInstantNanoseconds` reads the offset and ignores the bracket, so a self-
    // contradictory string parses fine as an instant. `ZonedDateTime.from` is what checks
    // the two agree, and it runs even when `timeZone` overrides the bracketed zone.
    // `[u-ca=...]` is already rejected upstream, so any remaining bracket is a time zone.
    const bracketed = value.includes("[")
      ? Temporal.ZonedDateTime.from(value)
      : null;

    // Temporal also accepts a bracketed *offset* time zone (`[-04:00]`), and canonicalises
    // every spelling of one (`[-0400]`, `[+05]`) to `±HH:MM`. That names no place and must
    // not reach the `timeZone` field, which would then claim GMT knows where the event
    // happened when all it has is the offset it already stores. The test is deliberately
    // for an offset rather than `isValidTimeZone`, which additionally rejects the
    // slash-less IANA aliases (`EST5EDT`, `Zulu`) that `zoned/` accepts inside a string.
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
      return {
        instant: instant.toString(),
        offset: instant.toZonedDateTimeISO(resolvedZone).offset,
        timeZone: resolvedZone,
      };
    }

    // No zone, so the only offset on record is the one written in the string — and with a
    // bracket present Temporal has already read it.
    if (bracketed !== null) {
      return { instant: instant.toString(), offset: bracketed.offset };
    }

    // Without one, the offset is the distance between two wall clocks: the digits as
    // written, and the same instant read in UTC. That recovers it without slicing the
    // string. The subtraction stays on `PlainDateTime` rather than going through an
    // instant, because a wall clock reaches a day further either side than an instant does
    // — `+275760-09-13T14:00:00+14:00` names a representable instant whose digits, read as
    // UTC, are past the end of the range. `PlainDateTime.from` parses every shape this
    // grammar allows but the `Z` designator, and a `Z` string's wall clock *is* the UTC
    // one, so its offset is `+00:00` by definition.
    const utcWallClock = instant.toZonedDateTimeISO("UTC").toPlainDateTime();
    const writtenWallClock =
      value.endsWith("Z") || value.endsWith("z")
        ? utcWallClock
        : Temporal.PlainDateTime.from(value);
    const offset = formatUtcOffset(
      BigInt(
        utcWallClock.until(writtenWallClock, { largestUnit: "nanosecond" })
          .nanoseconds,
      ),
    );

    return offset === null ? null : { instant: instant.toString(), offset };
  } catch {
    return null;
  }
}
