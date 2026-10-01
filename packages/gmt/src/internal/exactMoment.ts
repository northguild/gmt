import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../zoned/validate/isValidZonedDateTime";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { EXTENDED_UTC_OFFSET, TIME_ZONE_ANNOTATION } from "./isoStringBody";
import { wallClockAtOffset } from "./wallClockAtOffset";
import {
  utcOffsetStringNanoseconds,
  zonedDateTimeFrom,
} from "./zonedWallClock";

/**
 * How an exact moment was written, so a result can be written the same way: in a named zone
 * (the bracket), at a UTC offset (its text exactly as written), or as a `Z` instant.
 */
export type MomentNotation =
  | { kind: "zone"; timeZone: string }
  | { kind: "offset"; offset: string }
  | { kind: "utc" };

/** An exact moment: its epoch nanoseconds and how it was written. */
export type ExactMoment = { nanoseconds: bigint; notation: MomentNotation };

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
 * bracket is a tagged annotation, which the instant parse already decides.
 */
const zoneAnnotation = new RegExp(TIME_ZONE_ANNOTATION);

/**
 * Read an exact moment the way `transitTime` reads a departure, or `null`.
 *
 * - A zoned string (`…-04:00[America/New_York]`) is read through its bracket, which must name a
 *   real zone that agrees with the offset, as `isValidZonedDateTime` requires. A wall time with
 *   a bracket and no offset is read in that zone.
 * - A string that names a zone the zoned read rejects is `null`; it never falls back to its
 *   offset.
 * - Otherwise an instant (`Z` or an offset) as `parseInstantNanoseconds` reads it: calendar and
 *   elective annotations are ignored and a critical unknown one is rejected. Its offset text is
 *   kept exactly as written, sub-minute and `,` fractions included.
 *
 * @param value candidate zoned datetime or instant string
 * @returns the moment's epoch nanoseconds and notation, or null on invalid input
 *
 * @example readExactMoment("2024-06-15T10:00:00+09:00") // { nanoseconds: 1718413200000000000n, notation: { kind: "offset", offset: "+09:00" } }
 * @example readExactMoment("2024-06-15T10:00:00Z[Not/AZone]") // null
 */
export function readExactMoment(value: unknown): ExactMoment | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    if (isValidZonedDateTime(value)) {
      const zoned = zonedDateTimeFrom(value);
      return {
        nanoseconds: zoned.epochNanoseconds,
        notation: { kind: "zone", timeZone: zoned.timeZoneId },
      };
    }
    if (zoneAnnotation.test(value)) {
      return null;
    }

    const nanoseconds = parseInstantNanoseconds(value);
    if (nanoseconds === null) {
      return null;
    }
    const offset = trailingOffset.exec(value)?.[1] ?? "Z";
    return {
      nanoseconds,
      notation: offset === "Z" ? { kind: "utc" } : { kind: "offset", offset },
    };
  } catch {
    return null;
  }
}

/**
 * Write epoch nanoseconds the way a moment was written: in its zone, at its offset text, or as a
 * `Z` instant. `""` when the nanoseconds leave the instant range (±8.64e21 ns).
 *
 * - A zone notation is written as Temporal writes a `ZonedDateTime`: the offset in force at that
 *   instant, then the bracket.
 * - An offset notation keeps its text as written. The wall clock is shifted, never the instant
 *   (`wallClockAtOffset`), so the last hours of the range still write at a positive offset.
 *
 * @param nanoseconds epoch nanoseconds of the moment to write
 * @param notation how to write it, from `readExactMoment`
 * @returns the moment as a zoned, offset or `Z` string, or "" when it is out of range
 *
 * @example writeExactMoment(0n, { kind: "offset", offset: "+09:00" }) // "1970-01-01T09:00:00+09:00"
 * @example writeExactMoment(0n, { kind: "zone", timeZone: "UTC" }) // "1970-01-01T00:00:00+00:00[UTC]"
 */
export function writeExactMoment(
  nanoseconds: bigint,
  notation: MomentNotation,
): string {
  try {
    const instant = Temporal.Instant.fromEpochNanoseconds(nanoseconds);
    if (notation.kind === "zone") {
      return instant.toZonedDateTimeISO(notation.timeZone).toString();
    }
    if (notation.kind === "utc") {
      return instant.toString();
    }
    const wall = wallClockAtOffset(
      instant,
      utcOffsetStringNanoseconds(notation.offset),
    );
    return `${wall.toString()}${notation.offset}`;
  } catch {
    return "";
  }
}
