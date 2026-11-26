/**
 * UTC offsets to the second, read and written without rounding.
 *
 * Zones were not always whole minutes ahead of UTC: Africa/Monrovia ran at
 * `-00:44:30` until 1972 and New York at `-04:56:02` until 1883, and
 * `ZonedDateTime#offset` and the library's `getTimeZoneOffset` report those
 * offsets exactly. Temporal's `Instant#toString({ timeZone })` rounds the
 * offset to the minute (`-00:45`), and an offset time zone cannot hold seconds
 * at all (`toZonedDateTimeISO("-00:44:30")` throws). The library's instant
 * functions take no zone bracket, so they read a rounded offset as written: a
 * moment 30 seconds later. Every tool that reads or writes an offset goes
 * through these helpers instead.
 */

import { Temporal } from "@northguild/gmt";

/**
 * A UTC offset as Temporal writes it, unanchored for use inside a larger
 * pattern: `±HH:MM`, `±HH:MM:SS`, or `±HH:MM:SS.fraction`.
 */
export const OFFSET_SOURCE = String.raw`[+-]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?`;

const WHOLE_OFFSET = new RegExp(`^${OFFSET_SOURCE}$`);

/**
 * Nanoseconds `offset` runs ahead of UTC (negative west of it), or null when
 * `offset` is not a `±HH:MM[:SS[.fraction]]` offset. Temporal does the
 * parsing: the offset is read as the offset half of an instant at the epoch.
 */
export function offsetNanoseconds(offset: string): number | null {
  if (!WHOLE_OFFSET.test(offset)) return null;
  try {
    return Number(
      -Temporal.Instant.from(`1970-01-01T00:00:00${offset}`).epochNanoseconds,
    );
  } catch {
    return null;
  }
}

/** `offset` in minutes ahead of UTC, seconds kept as a fraction (`-00:44:30` → -44.5), or null. */
export function offsetMinutes(offset: string): number | null {
  const ns = offsetNanoseconds(offset);
  return ns === null ? null : ns / 60e9;
}

/**
 * The difference `after − before` between two offsets as a Temporal duration
 * (seconds and below kept), for moving a wall clock across a transition.
 * Null when either is not an offset.
 */
export function offsetShift(
  before: string,
  after: string,
): Temporal.Duration | null {
  const a = offsetNanoseconds(after);
  const b = offsetNanoseconds(before);
  if (a === null || b === null) return null;
  return Temporal.Duration.from({ nanoseconds: a - b }).round({
    largestUnit: "hours",
  });
}

/**
 * `instant` written as the wall clock at a fixed `offset` plus that offset,
 * to the second: `instantAtOffset(1960-06-01T12:00:00Z, "-00:44:30")` is
 * `1960-06-01T11:15:30-00:44:30`. Works for an offset with seconds, which no
 * Temporal offset time zone can hold. Null when `offset` is not an offset.
 */
export function instantAtOffset(
  instant: Temporal.Instant,
  offset: string,
): string | null {
  const ns = offsetNanoseconds(offset);
  if (ns === null) return null;
  const wall = instant
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime()
    .add({ nanoseconds: ns });
  return wall.toString() + offset;
}

/** `instant` in `timeZone`, with the zone's exact offset. Throws on an unknown zone. */
export function exactOffsetText(
  instant: Temporal.Instant,
  timeZone: string,
): string {
  const zoned = instant.toZonedDateTimeISO(timeZone);
  return zoned.toPlainDateTime().toString() + zoned.offset;
}

/**
 * Reads an instant's wall clock in `zone` for labels. A zone id, or an offset
 * in whole minutes, is a Temporal time zone. An offset with seconds
 * (`-00:44:30`) is not, so its wall clock is carried on a UTC stand-in, which
 * the labels read the same way; `msOf` maps a stand-in back to its instant.
 */
export function wallReader(zone: string): ((
  ms: number,
) => Temporal.ZonedDateTime) & {
  msOf: (z: Temporal.ZonedDateTime) => number;
} {
  const ns = offsetNanoseconds(zone);
  const shift = ns !== null && ns % 60e9 !== 0 ? ns : null;
  const read = (ms: number): Temporal.ZonedDateTime =>
    shift === null
      ? Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone)
      : Temporal.Instant.fromEpochMilliseconds(ms)
          .add({ nanoseconds: shift })
          .toZonedDateTimeISO("UTC");
  return Object.assign(read, {
    msOf: (z: Temporal.ZonedDateTime): number =>
      shift === null ? z.epochMilliseconds : z.epochMilliseconds - shift / 1e6,
  });
}
