// Every import is direct, never through `./index`: the barrel re-exports this file, and the public
// `toOffsetInstant` reads it through the barrel.
import type { OffsetInstant } from "../instant/convert/toOffsetInstant";
import { utcOffset } from "../regex/utc-offset";
import type { Hl7Precision } from "../types/hl7";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { isoStringBody } from "./isoStringBody";
import { Temporal } from "./temporal";
import { hasTimeZoneAnnotation } from "./timeZoneAnnotation";
import { isObject } from "./isObject";
import {
  formatUtcOffset,
  parseUtcOffsetNanoseconds,
  writtenOffset,
} from "./utcOffsetString";
import { wallClockAtOffset } from "./wallClockAtOffset";
import { zonedDateTimeFrom } from "./zonedWallClock";
import { frameOffset, type ZoneFrame, zoneFrame } from "./zoneFrame";

/**
 * The core of `toOffsetInstant`: the instant an ISO 8601 or RFC 9557 string names, paired with
 * the offset in force where it happened. Never throws.
 *
 * @param value ISO 8601 instant string, with an optional RFC 9557 zone annotation
 * @param timeZone the zone to read the offset in, instead of the written one
 * @returns the pair, or null when `value` is not an instant or `timeZone` is not a zone
 *
 * @example readOffsetInstant("2024-07-15T16:00:00+05:30") // { instant: "2024-07-15T10:30:00Z", offset: "+05:30" }
 * @example readOffsetInstant("2024-06-15T10Z") // null (an hour-only time; see `readFormOffsetInstant`)
 */
export function readOffsetInstant(
  value: string,
  timeZone?: string,
): OffsetInstant | null {
  const epochNanoseconds = parseInstantNanoseconds(value);

  if (epochNanoseconds === null) {
    return null;
  }

  const frame = timeZone === undefined ? undefined : zoneFrame(timeZone);

  if (frame === null) {
    return null;
  }

  return pairAt(value, epochNanoseconds, frame);
}

/**
 * The pair for a string `isoHl7Form` matched, at the precision `isoHl7Precision` read from it.
 * Never throws.
 *
 * An hour-only time (`2024-06-15T10Z`, `…T23-05:00`) is ISO 8601-1 §5.3.1.3 reduced precision.
 * `readOffsetInstant` refuses it, as `isValidInstant` does, because GMT's instant shape needs a
 * minute. Here the caller has already matched the form, so Temporal reads the hour directly
 * (`Temporal.Instant.from("2024-06-15T10Z")` is `2024-06-15T10:00:00Z`). Every finer form goes
 * through `readOffsetInstant`.
 *
 * @param value a string `isoHl7Form` matched, with its offset
 * @param written the precision `isoHl7Precision` read
 * @returns the pair, or null when the value is not an instant
 *
 * @example readFormOffsetInstant("2024-06-15T23-05:00", "hour") // { instant: "2024-06-16T04:00:00Z", offset: "-05:00" }
 */
export function readFormOffsetInstant(
  value: string,
  written: Hl7Precision,
): OffsetInstant | null {
  if (written !== "hour") {
    return readOffsetInstant(value);
  }
  let epochNanoseconds: bigint;
  try {
    epochNanoseconds = Temporal.Instant.from(value).epochNanoseconds;
  } catch {
    return null;
  }
  return pairAt(value, epochNanoseconds, undefined);
}

/** The pair for `value` once its instant is read; `frame` is the caller's zone, if any. */
function pairAt(
  value: string,
  epochNanoseconds: bigint,
  frame: ZoneFrame | undefined,
): OffsetInstant | null {
  try {
    // `parseInstantNanoseconds` does not validate the bracket, so a self-contradictory string
    // parses fine as an instant. `ZonedDateTime.from` is what checks
    // the two agree, and it runs even when `timeZone` overrides the bracketed zone. A calendar
    // or elective annotation alone leaves an offset-only instant (`hasTimeZoneAnnotation`).
    const body = isoStringBody(value);
    const bracketed = hasTimeZoneAnnotation(value)
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

    // A stored offset with seconds is the pair's offset as it stands. Like an offset identifier it
    // names no place, so it fills no `timeZone` field.
    if (frame !== undefined && frame.shiftNanoseconds !== 0n) {
      return { instant: instant.toString(), offset: frameOffset(frame) };
    }

    const resolvedZone = frame?.timeZone ?? bracketedZone;

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

/**
 * The core of `fromOffsetInstant`: the local time an instant-plus-offset pair describes, with the
 * pair's own offset, or the bracketed zoned string when the pair names a zone. Never throws.
 *
 * @param value `{ instant, offset, timeZone? }` pair, as `readOffsetInstant` returns
 * @returns the local ISO 8601 string, or `""` on invalid input or a zone that contradicts the offset
 *
 * @example writeOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" }) // "2024-07-15T12:00:00-04:00"
 */
export function writeOffsetInstant(value: OffsetInstant): string {
  try {
    if (!isObject(value)) {
      return "";
    }

    const epochNanoseconds = parseInstantNanoseconds(value.instant);
    const offsetNanoseconds = parseUtcOffsetNanoseconds(value.offset);

    if (epochNanoseconds === null || offsetNanoseconds === null) {
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
      // clock (`wallClockAtOffset` keeps both range limits and sub-minute offsets).
      const wallClock = wallClockAtOffset(instant, offsetNanoseconds);

      return `${wallClock.toString()}${offset}`;
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
