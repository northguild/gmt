import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../zoned/get/getSystemTimeZone";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import { instantFrom } from "./instantNanoseconds";
import { formatUtcOffset, parseUtcOffsetNanoseconds } from "./utcOffsetString";
import { wallClockAtOffset } from "./wallClockAtOffset";

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;

/**
 * How local time is read for a time zone argument: a Temporal time zone, plus the part of a stored
 * UTC offset no time zone identifier can carry.
 *
 * A time zone identifier stops at minutes (TC39 Temporal §13.31, the RFC 9557 / ISO 8601 grammar:
 * `TimeZoneIdentifier ::: UTCOffset[~SubMinutePrecision] | TimeZoneIANAName`), but a zone's real
 * offset does not: `Africa/Monrovia` stood at `-00:44:30` until 1972, and `getTimeZoneOffset`
 * returns it. A fixed offset is still a complete rule for local time, so a function whose result
 * names no zone reads one at any precision.
 *
 * The real offset is the offset of `timeZone` plus `shiftNanoseconds`. One frame serves a whole
 * call, so every value of the call is placed in the same zone.
 */
export type ZoneFrame = {
  /**
   * A Temporal time zone identifier. For an offset with seconds it is the offset's whole minutes
   * (`-00:44` for `-00:44:30`, `+02:10` for `+02:10:08`, `+00:00` within a minute of zero).
   */
  timeZone: string;
  /**
   * `0n`, or the seconds the real offset has beyond the offset of `timeZone`, in nanoseconds:
   * under a minute, with the offset's own sign (east positive).
   */
  shiftNanoseconds: bigint;
};

/**
 * Read a time zone argument that may also be a stored UTC offset.
 *
 * The only place that turns "time zone identifier or stored offset" into something Temporal can
 * use. It accepts exactly what `isValidTimeZone` or `isValidUtcOffset` accepts, by five rules in
 * order:
 *
 * 1. Not a string: null.
 * 2. A time zone identifier (`isValidTimeZone`): that identifier as written, no shift. Every
 *    argument that was valid before stored offsets were read takes this branch.
 * 3. Not a stored offset (`±HH:MM[:SS]`): null.
 * 4. A whole number of minutes (`+05:30:00`): the identifier it canonicalises to (`+05:30`), no
 *    shift.
 * 5. Otherwise (`-00:44:30`): the offset's whole minutes as the zone (`-00:44`), shifted by its
 *    seconds with the offset's own sign (30 seconds further west).
 *
 * - The returned `timeZone` is always a time zone identifier, so it is safe in a bracket or in
 *   `Intl.DateTimeFormat`. A seconds offset never becomes one: a caller that writes the zone into
 *   its result validates with `isValidTimeZone` instead and does not call this.
 *
 * @param zone the caller's time zone argument
 * @returns the frame, or null when `zone` is neither a time zone identifier nor a stored offset
 *
 * @example zoneFrame("America/New_York") // { timeZone: "America/New_York", shiftNanoseconds: 0n }
 * @example zoneFrame("+05:30:00") // { timeZone: "+05:30", shiftNanoseconds: 0n }
 * @example zoneFrame("-00:44:30") // { timeZone: "-00:44", shiftNanoseconds: -30000000000n }
 * @example zoneFrame("Z") // null
 */
export function zoneFrame(zone: unknown): ZoneFrame | null {
  if (typeof zone !== "string") {
    return null;
  }

  if (isValidTimeZone(zone)) {
    return { timeZone: zone, shiftNanoseconds: 0n };
  }

  const offsetNanoseconds = parseUtcOffsetNanoseconds(zone);

  if (offsetNanoseconds === null) {
    return null;
  }

  // BigInt remainder keeps the dividend's sign, so this is the offset's seconds with its sign,
  // and what is left is its whole minutes: the minute offset between it and zero.
  const shiftNanoseconds = offsetNanoseconds % NANOSECONDS_PER_MINUTE;
  const timeZone = formatUtcOffset(offsetNanoseconds - shiftNanoseconds);

  return timeZone === null ? null : { timeZone, shiftNanoseconds };
}

/** The real offset of a frame with a shift: its minute zone's offset plus the shift. */
function frameOffsetNanoseconds(frame: ZoneFrame): bigint {
  // The zone of a shifted frame is one `zoneFrame` wrote with `formatUtcOffset`, so it reads back.
  const zoneOffset = parseUtcOffsetNanoseconds(frame.timeZone);

  if (frame.shiftNanoseconds === 0n || zoneOffset === null) {
    throw new RangeError("the frame carries no stored offset");
  }

  return zoneOffset + frame.shiftNanoseconds;
}

/**
 * Read the `timeZone` option of a `unix/` or `utc/` function whose result names no zone.
 *
 * - Omitted (`undefined`) is `"UTC"`: an epoch and a UTC string name an instant, so no host zone
 *   is read unless asked for.
 * - `"local"` is the system time zone, or null when the host reports none that is valid.
 * - Anything else is read by `zoneFrame`.
 *
 * `normalizeTimeZone` is the twin for a function that writes the zone into its result or hands it
 * to `Intl.DateTimeFormat`: it accepts a time zone identifier only.
 *
 * @param option the caller's `timeZone` option
 * @returns the frame, or null when the option is invalid
 *
 * @example normalizeZoneFrame(undefined) // { timeZone: "UTC", shiftNanoseconds: 0n }
 * @example normalizeZoneFrame("local") // the system zone, e.g. { timeZone: "America/New_York", shiftNanoseconds: 0n }
 * @example normalizeZoneFrame("-00:44:30") // { timeZone: "-00:44", shiftNanoseconds: -30000000000n }
 * @example normalizeZoneFrame("America/New_Yrok") // null
 */
export function normalizeZoneFrame(option?: unknown): ZoneFrame | null {
  if (option === undefined) {
    return { timeZone: "UTC", shiftNanoseconds: 0n };
  }

  return zoneFrame(option === "local" ? getSystemTimeZone() : option);
}

/**
 * Read an instant on a frame's local wall clock. For a function that only reads fields.
 *
 * - A seconds offset is read with `wallClockAtOffset`, which is exact up to both limits of the
 *   instant range; `frameZoned` is not.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param instant the exact time
 * @param frame the frame from `zoneFrame`
 * @returns the local wall clock
 *
 * @example frameWallClock(Temporal.Instant.from("1970-01-01T12:44:30Z"), zoneFrame("-00:44:30")).toString() // "1970-01-01T12:00:00"
 */
export function frameWallClock(
  instant: Temporal.Instant,
  frame: ZoneFrame,
): Temporal.PlainDateTime {
  return frame.shiftNanoseconds === 0n
    ? instant.toZonedDateTimeISO(frame.timeZone).toPlainDateTime()
    : wallClockAtOffset(instant, frameOffsetNanoseconds(frame));
}

/**
 * Read the current instant on a frame's local wall clock.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param frame the frame from `zoneFrame`
 * @returns the local wall clock now
 *
 * @example frameNowWallClock(zoneFrame("-00:44:30")).toPlainDate().toString() // today's date at -00:44:30
 */
export function frameNowWallClock(frame: ZoneFrame): Temporal.PlainDateTime {
  return frame.shiftNanoseconds === 0n
    ? Temporal.Now.zonedDateTimeISO(frame.timeZone).toPlainDateTime()
    : wallClockAtOffset(Temporal.Now.instant(), frameOffsetNanoseconds(frame));
}

/**
 * Place an instant on a frame's local clock as a `Temporal.ZonedDateTime`, for a body that does
 * arithmetic on one.
 *
 * - For a seconds offset the value sits in the frame's minute zone, at the instant plus the
 *   shift, so its wall clock is the real local one. At a constant offset, arithmetic on the wall
 *   clock is the same in any fixed-offset zone, and a day is always 24 hours. Its own
 *   `epochNanoseconds`, `offset` and `timeZoneId` are not the real ones: turn a result back with
 *   `frameInstant`, and never write it as a string.
 * - Every value of one call is placed with the same frame, so all of them sit in one zone and
 *   are off by the same shift. Comparing their `epochNanoseconds`, and `until` between them, give
 *   what the real instants give.
 * - Throws `RangeError` when the instant plus the shift is outside the instant range: within the
 *   shift's length, under a minute, of the last instant for an offset east of UTC, and of the
 *   first for one west. The caller returns its sentinel there, and its JSDoc says so. A function
 *   that only reads fields uses `frameWallClock`, which has no such edge.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param instant the exact time
 * @param frame the frame from `zoneFrame`
 * @returns the zoned date-time to compute with
 *
 * @example frameInstant(frameZoned(Temporal.Instant.from("1970-01-01T12:44:30Z"), zoneFrame("-00:44:30")).startOfDay(), zoneFrame("-00:44:30")).toString() // "1970-01-01T00:44:30Z"
 */
export function frameZoned(
  instant: Temporal.Instant,
  frame: ZoneFrame,
): Temporal.ZonedDateTime {
  return frame.shiftNanoseconds === 0n
    ? instant.toZonedDateTimeISO(frame.timeZone)
    : instant
        .add({ nanoseconds: Number(frame.shiftNanoseconds) })
        .toZonedDateTimeISO(frame.timeZone);
}

/**
 * The real epoch nanoseconds of a value `frameZoned` produced, or one computed from it.
 *
 * @param zoned a zoned date-time on the frame's local clock
 * @param frame the frame it was placed on
 * @returns epoch nanoseconds of the instant it names
 *
 * @example frameEpochNanoseconds(frameZoned(Temporal.Instant.from("1970-01-01T12:44:30Z"), zoneFrame("-00:44:30")), zoneFrame("-00:44:30")) // 45870000000000n
 */
export function frameEpochNanoseconds(
  zoned: Temporal.ZonedDateTime,
  frame: ZoneFrame,
): bigint {
  // The value was placed the shift later than its instant, so that the minute zone's wall clock
  // is the real local one: local time = instant + offset (TC39 Temporal GetISODateTimeFor).
  return zoned.epochNanoseconds - frame.shiftNanoseconds;
}

/**
 * The real instant of a value `frameZoned` produced, or one computed from it.
 *
 * Throws `RangeError` when the instant is outside Temporal's range; callers wrap it in their own
 * try/catch.
 *
 * @param zoned a zoned date-time on the frame's local clock
 * @param frame the frame it was placed on
 * @returns the instant it names
 *
 * @example frameInstant(frameZoned(Temporal.Instant.from("1970-01-01T12:44:30Z"), zoneFrame("-00:44:30")), zoneFrame("-00:44:30")).toString() // "1970-01-01T12:44:30Z"
 */
export function frameInstant(
  zoned: Temporal.ZonedDateTime,
  frame: ZoneFrame,
): Temporal.Instant {
  return frame.shiftNanoseconds === 0n
    ? zoned.toInstant()
    : Temporal.Instant.fromEpochNanoseconds(
        frameEpochNanoseconds(zoned, frame),
      );
}

/**
 * A frame's stored offset as text: `±HH:MM:SS` for a seconds offset.
 *
 * Throws `RangeError` for a frame with no shift, whose offset is its zone's to give; callers wrap
 * it in their own try/catch.
 *
 * @param frame a frame whose `shiftNanoseconds` is not `0n`
 * @returns the offset string
 *
 * @example frameOffset(zoneFrame("-00:44:30")) // "-00:44:30"
 */
export function frameOffset(frame: ZoneFrame): string {
  const offset = formatUtcOffset(frameOffsetNanoseconds(frame));

  if (offset === null) {
    throw new RangeError("the frame carries no stored offset");
  }

  return offset;
}

/**
 * The instant a local wall time names at a frame's stored offset.
 *
 * The wall time and the offset are joined into one date-time string and read by Temporal, which
 * reads an offset with seconds there (TC39 Temporal §13.31,
 * `DateTimeUTCOffset[Z] ::: [+Z] UTCDesignator | UTCOffset[+SubMinutePrecision]`). A fixed offset has no
 * transition, so the wall time is never repeated or skipped and there is nothing to disambiguate.
 * Exact up to both limits of the instant range.
 *
 * Throws what Temporal throws; callers wrap it in their own try/catch.
 *
 * @param wallClock an ISO 8601 `<date>T<time>` body with no offset and no annotation
 * @param frame a frame whose `shiftNanoseconds` is not `0n`
 * @returns the instant
 *
 * @example instantOfWallClock("1970-01-01T12:00:00", zoneFrame("-00:44:30")).toString() // "1970-01-01T12:44:30Z"
 */
export function instantOfWallClock(
  wallClock: string,
  frame: ZoneFrame,
): Temporal.Instant {
  return instantFrom(`${wallClock}${frameOffset(frame)}`);
}
