import { Temporal } from "@js-temporal/polyfill";
import { instantLeapSecond } from "../regex/leap-second";
import { hasInstantShape, isoStringBody } from "./isoStringBody";
import { parseUtcOffsetNanoseconds } from "./utcOffsetString";
import {
  isValidEpoch,
  offsetAt,
  roundToMinute,
  utcEpochNanoseconds,
} from "./zonedWallClock";

/**
 * The first time-zone annotation in the string, as `TIME_ZONE_ANNOTATION` defines one (a
 * bracket without `=`), with its identifier captured without the critical flag. Only a string
 * that names a zone can have a rounded offset to resolve. The capture goes to Temporal, which
 * decides whether it is a zone.
 */
const zoneAnnotation = /\[!?([^\]=]+)\]/;

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
/** The most a minute-rounded offset can differ from the real one (half-expand rounding). */
const HALF_MINUTE = 30_000_000_000n;
/** `±HH:MM`: the length of an offset written to the minute. */
const MINUTE_OFFSET_LENGTH = 6;

/**
 * An instant body that ends in an offset written to the minute (`±HH:MM`), with no seconds
 * part. The sign must sit directly before `HH:MM`, so `-04:56:02` does not match on its `56:02`.
 */
const minuteOffset = /[+-]\d{2}:\d{2}$/;

/**
 * Parse an ISO 8601 instant string to epoch nanoseconds, or `null` when it is not one.
 *
 * The single definition of "an instant string GMT accepts", and of the instant it names. Every
 * GMT function that reads a moment without keeping its zone reads through here.
 *
 * **Which strings.** The RFC 9557 instant grammar `Temporal.Instant.from` parses, restricted to
 * ISO 8601 extended format before the first `[` (`instantBody`: `<date>T<time>`, then `Z` or
 * `±HH:MM[:SS[.fraction]]`), minus leap seconds (which Temporal clamps rather than rejects).
 * Basic format, a space or lower-case `t` separator, a lower-case `z` and an hour-only time or
 * offset are rejected. Annotations are read as Temporal reads them (proposal-temporal
 * `ParseISODateTime`, RFC 9557 §3.3): a time zone, calendar (`[u-ca=hebrew]`) or elective
 * (`[foo=bar]`) annotation never makes a string invalid, and an unknown critical one
 * (`[!foo=bar]`) is rejected.
 *
 * **Which instant.** The written offset fixes it, as in `Temporal.Instant.from`, with one
 * exception:
 *
 * - **A minute-rounded offset is read as its zone's real offset.** When the string has a
 *   bracketed zone and an offset written to the minute, and that offset is the zone's actual
 *   offset at that wall time rounded to the minute, the instant is the one the zone gives. This
 *   is TC39 `ToTemporalZonedDateTime`'s match-minutes rule (`InterpretISODateTimeOffset`),
 *   applied to the zone and the offset alone. It exists because
 *   `Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute: in a
 *   zone with a sub-minute offset (`Africa/Monrovia` before 1972, at −00:44:30, written
 *   `-00:45`), the string a zoned function writes would otherwise be read up to 30 seconds off.
 * - **The instant range is the only range.** The match has no `CheckISODaysRange` on the local
 *   date, which `Temporal.ZonedDateTime.from` has, and does not need the written offset's own
 *   reading to be in range. So every string Temporal writes for an instant in range is read
 *   back, the first and last instants included: `-271821-04-19T23:58:45-00:01[Europe/London]`
 *   (London's local mean time, −00:01:15) is the first instant, although its local date is
 *   outside Temporal's date range and its reading at −00:01 is 15 seconds before the range.
 * - **A repeated wall time inside a sub-minute offset change reads as its first pass.** The
 *   match is against each candidate instant in order, so when a wall time happened twice and
 *   the rounded offset fits the first pass, the first pass is the answer, even if the string
 *   was written for the second. This is a class of strings, not one zone: it arises wherever a
 *   zone's history has a fall-back of under a minute at a sub-minute offset. The example
 *   test262 uses: Pacific/Niue moved from −11:19:40 to −11:20:00 at the end of
 *   15 October 1952, so 23:59:40 to 23:59:59 happened twice, 20 seconds apart, and both passes
 *   are written `-11:20`: `1952-10-15T23:59:59-11:20[Pacific/Niue]` reads as the pass at
 *   −11:19:40. This is `Temporal.ZonedDateTime.from`'s own reading (test262
 *   `intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`), and the one kind
 *   of string Temporal writes that an instant reader does not read as the instant it was
 *   written for. The exact offset, `-11:20:00`, names the second pass.
 * - **Everything else keeps the written offset.** The complete list: a string without a
 *   bracket; a `Z` instant; an offset written with seconds, which TC39 matches exactly
 *   (`-00:45:00[Africa/Monrovia]` is −00:45:00); a bracket whose zone does not exist; and a
 *   bracket whose zone has no instant in range with that wall time at the written offset or at
 *   an offset that rounds to it (`-00:44[Africa/Monrovia]`, `-05:00[America/New_York]` in
 *   June). Such a bracket is not validated here; a function that keeps the zone
 *   (`transitTime`, `toOffsetInstant`) rejects it instead. Calendar and elective annotations
 *   never change the reading. A string whose written reading is outside the instant range, and
 *   which the zone does not bring inside it, is `null`.
 *
 * The zone's offset comes from Temporal's time-zone data; nothing here holds an offset or a
 * zone name. A string in a whole-minute zone costs two offset lookups more than
 * `Temporal.Instant.from`. Callers layer their own sentinel on top — `toNanoseconds` returns
 * `0n`, `spanNs` returns `null` — so the parse result stays unambiguous here.
 *
 * @param value candidate ISO 8601 instant string
 * @returns nanoseconds since the Unix epoch, or null when `value` is not a valid instant
 *
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example parseInstantNanoseconds("2016-12-31T23:59:60Z") // null — leap second
 * @example parseInstantNanoseconds("2024-03-10T12:00:00") // null — no offset designator
 * @example parseInstantNanoseconds("20240310T120000Z") // null — basic format
 * @example parseInstantNanoseconds("2024-03-10T12:00:00z") // null — lower-case z
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z[u-ca=hebrew]") // 0n — calendar annotation ignored
 * @example parseInstantNanoseconds("1960-01-01T00:20:00-00:45[Africa/Monrovia]") // -315615330000000000n — 01:04:30Z: Monrovia stood at -00:44:30
 * @example parseInstantNanoseconds("1960-01-01T00:20:00-00:45") // -315615300000000000n — 01:05:00Z: no zone, so the offset is exact
 * @example parseInstantNanoseconds("1952-10-15T23:59:59-11:20[Pacific/Niue]") // -543069621000000000n — the first pass of a repeated second, at -11:19:40
 * @example parseInstantNanoseconds("-271821-04-19T23:58:45-00:01[Europe/London]") // -8640000000000000000000n — the first instant, at London's -00:01:15
 * @example parseInstantNanoseconds("2024-06-15T10:00:00Z[Not/AZone]") // 1718445600000000000n — the bracket is not validated
 */
export function parseInstantNanoseconds(value: string): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  if (instantLeapSecond.test(value) || !hasInstantShape(value)) {
    return null;
  }

  let written: bigint | null;
  try {
    written = Temporal.Instant.from(value).epochNanoseconds;
  } catch {
    // Not an instant as written. It may still be one through its zone: see `zonedReading`.
    written = null;
  }

  const body = isoStringBody(value);
  const zone = minuteOffset.test(body)
    ? zoneAnnotation.exec(value)?.[1]
    : undefined;
  if (zone === undefined) {
    return written;
  }

  try {
    return written === null
      ? zonedReadingOutsideWrittenRange(value, body, zone)
      : (zonedReading(zone, written, () => writtenOffset(body)) ?? written);
  } catch {
    // The zone does not exist: the written offset stands.
    return written;
  }
}

/** The nanoseconds of the `±HH:MM` offset that ends `body`, parsed by Temporal. */
function writtenOffset(body: string): bigint | null {
  return parseUtcOffsetNanoseconds(body.slice(-MINUTE_OFFSET_LENGTH));
}

/**
 * TC39 `InterpretISODateTimeOffset`'s match for a minute-precision offset, on epoch nanoseconds:
 * the instant `zone` gives a wall time written with `offset`, or `null` when the zone has no
 * instant in range whose offset is `offset` or rounds to it.
 *
 * `written` is the wall time read at the written offset. A candidate instant has the same wall
 * time at the zone's own offset, so it lies within half a minute of `written`, and the zone's
 * offsets half a minute either side are the only ones a candidate can have. When both are whole
 * minutes nothing can round, the written offset is never read, and the answer is `null`: the
 * common case costs two offset lookups. Otherwise each candidate is checked against the zone and
 * the earliest match wins, as the spec's loop over the possible instants does. It assumes a
 * zone changes its offset at most once in any one minute.
 *
 * Unlike `Temporal.ZonedDateTime.from` this has no `CheckISODaysRange` on the local date: an
 * instant is in range or it is not, whatever date its wall clock shows.
 *
 * @throws RangeError when `zone` is not a time zone
 */
function zonedReading(
  zone: string,
  written: bigint,
  offset: () => bigint | null,
): bigint | null {
  const before = offsetAt(zone, written - HALF_MINUTE);
  const after = offsetAt(zone, written + HALF_MINUTE);
  if (
    before % NANOSECONDS_PER_MINUTE === 0n &&
    after % NANOSECONDS_PER_MINUTE === 0n
  ) {
    return null;
  }

  const writtenOffsetNanoseconds = offset();
  if (writtenOffsetNanoseconds === null) {
    return null;
  }

  // With one offset across the whole minute a candidate needs no second look at the zone: it
  // lies inside that minute. Across a change, each side's candidate must fall on its own side.
  const steady = before === after;
  let earliest: bigint | null = null;
  for (const candidateOffset of steady ? [before] : [before, after]) {
    const candidate = written + writtenOffsetNanoseconds - candidateOffset;
    if (
      (candidateOffset === writtenOffsetNanoseconds ||
        roundToMinute(candidateOffset) === writtenOffsetNanoseconds) &&
      isValidEpoch(candidate) &&
      (steady || offsetAt(zone, candidate) === candidateOffset) &&
      (earliest === null || candidate < earliest)
    ) {
      earliest = candidate;
    }
  }
  return earliest;
}

/**
 * `zonedReading` for a string `Temporal.Instant.from` refused. At the range limits the written,
 * minute-rounded offset can put the literal reading just outside the instant range while the
 * zone's real offset keeps the instant inside it: Europe/London at local mean time (−00:01:15)
 * writes the first instant as `-271821-04-19T23:58:45-00:01`, 15 seconds before the range when
 * read at −00:01. Temporal reads both halves again: the wall clock as a `PlainDateTime`, from
 * the part before the first annotation, and the annotations on a stand-in instant, exactly as
 * `Temporal.Instant.from` reads them (a calendar id is not checked). So every other reason the
 * string was refused (an invalid date, an unknown critical annotation) is refused again here
 * by the throw.
 *
 * @throws RangeError when the string is not a date-time, or `zone` is not a time zone
 */
function zonedReadingOutsideWrittenRange(
  value: string,
  body: string,
  zone: string,
): bigint | null {
  const offset = writtenOffset(body);
  if (offset === null) {
    return null;
  }
  // The annotations are read as an instant's are: on a stand-in instant, so an unknown critical
  // annotation or a misplaced zone throws, and a calendar id is not checked.
  Temporal.Instant.from(`1970-01-01T00:00:00Z${value.slice(body.length)}`);
  const wall = Temporal.PlainDateTime.from(body);
  return zonedReading(zone, utcEpochNanoseconds(wall) - offset, () => offset);
}

/**
 * `parseInstantNanoseconds` as a `Temporal.Instant`, for callers that already hold a validated
 * string and go on to Temporal arithmetic. Use it wherever a caller's instant string would
 * otherwise go to `Temporal.Instant.from`, so a minute-rounded offset is read the same way
 * everywhere. Throws where `Temporal.Instant.from` throws, so it sits inside the caller's `try`
 * like any other Temporal parse.
 *
 * @param value ISO 8601 instant or zoned datetime string
 * @returns the instant the string names
 * @throws RangeError when `value` is not a valid instant
 *
 * @example instantFrom("1960-01-01T00:20:00-00:45[Africa/Monrovia]").toString() // "1960-01-01T01:04:30Z"
 * @example instantFrom("2024-06-15T10:00:00") // throws RangeError
 */
export function instantFrom(value: string): Temporal.Instant {
  const nanoseconds = parseInstantNanoseconds(value);
  if (nanoseconds === null) {
    throw new RangeError("Not an ISO 8601 instant string");
  }
  return Temporal.Instant.fromEpochNanoseconds(nanoseconds);
}
