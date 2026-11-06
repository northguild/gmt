import { Temporal } from "./temporal";
import type { Disambiguation, Offset, Overflow } from "../types";
import {
  MAX_EPOCH_NANOSECONDS,
  MAX_ISO_EPOCH_DAYS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";

/*
 * ---------------------------------------------------------------------------------------------
 * TC39 wall-clock abstract operations, kept for the zoned-difference port
 * ---------------------------------------------------------------------------------------------
 * `temporal-polyfill` 1.0.8 resolves every wall clock and start of day correctly, at the range
 * limits and before 1847, and matches an offset written with seconds exactly; `zonedDateTimeFrom`
 * is `Temporal.ZonedDateTime.from`. What remains here is the part `./zonedDifference/` and
 * `./zonedDifference/nudgeOrigin.ts` (D22) mirror from the specification:
 * `GetPossibleEpochNanoseconds`, `DisambiguatePossibleEpochNanoseconds` and `GetEpochNanosecondsFor`,
 * rebuilt from the `ZonedDateTime` constructor and `offsetNanoseconds`, plus the helpers that read
 * an offset or a range limit.
 * ---------------------------------------------------------------------------------------------
 */

/** Options accepted by `Temporal.ZonedDateTime.from`. */
export interface ZonedFromOptions {
  disambiguation?: Disambiguation;
  offset?: Offset;
  overflow?: Overflow;
}

type ResolvedDisambiguation = NonNullable<Disambiguation>;

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60_000_000_000n;

const UNIX_EPOCH_DATE = new Temporal.PlainDate(1970, 1, 1);

/** RFC 9557 offset with a seconds field. */
export const UTC_OFFSET_WITH_SECONDS =
  /^[^[]*[Tt ][^[+\-−]*[+\-−]\d{2}:?\d{2}:?\d{2}/;

function epochDays(date: Temporal.PlainDate): number {
  return UNIX_EPOCH_DATE.until(date.withCalendar("iso8601"), {
    largestUnit: "day",
  }).days;
}

/**
 * True when the date part of a wall clock is inside the TC39 `CheckISODaysRange` limit, which
 * Temporal applies to the local date (not only the instant) under `prefer` and `reject`.
 *
 * @example isWithinIsoDaysRange(Temporal.PlainDateTime.from("-271821-04-20T00:00:00")) // true
 * @example isWithinIsoDaysRange(Temporal.PlainDateTime.from("-271821-04-19T23:59:00")) // false
 */
export function isWithinIsoDaysRange(wall: Temporal.PlainDateTime): boolean {
  return Math.abs(epochDays(wall.toPlainDate())) <= MAX_ISO_EPOCH_DAYS;
}

/** Offset time zones (`+10:00`) and `UTC` never consult tz data, so neither defect reaches them. */
export function isNamedTimeZone(timeZone: string): boolean {
  return (
    timeZone !== "UTC" && !timeZone.startsWith("+") && !timeZone.startsWith("-")
  );
}

/** TC39 `IsValidEpochNanoseconds`. */
export function isValidEpoch(epochNanoseconds: bigint): boolean {
  return (
    epochNanoseconds >= MIN_EPOCH_NANOSECONDS &&
    epochNanoseconds <= MAX_EPOCH_NANOSECONDS
  );
}

function clampEpoch(epochNanoseconds: bigint): bigint {
  if (epochNanoseconds < MIN_EPOCH_NANOSECONDS) return MIN_EPOCH_NANOSECONDS;
  if (epochNanoseconds > MAX_EPOCH_NANOSECONDS) return MAX_EPOCH_NANOSECONDS;
  return epochNanoseconds;
}

/** UTC offset in force at an instant, reading the nearest limit for an instant outside the range. */
export function offsetAt(timeZone: string, epochNanoseconds: bigint): bigint {
  return BigInt(
    new Temporal.ZonedDateTime(clampEpoch(epochNanoseconds), timeZone)
      .offsetNanoseconds,
  );
}

/** TC39 `GetUTCEpochNanoseconds`: the wall clock read as if it were UTC (may lie outside the range). */
export function utcEpochNanoseconds(wall: Temporal.PlainDateTime): bigint {
  const days = BigInt(epochDays(wall.toPlainDate()));
  const timeOfDay =
    BigInt(wall.hour) * 3_600_000_000_000n +
    BigInt(wall.minute) * NANOSECONDS_PER_MINUTE +
    BigInt(wall.second) * 1_000_000_000n +
    BigInt(wall.millisecond) * 1_000_000n +
    BigInt(wall.microsecond) * 1_000n +
    BigInt(wall.nanosecond);

  return days * NANOSECONDS_PER_DAY + timeOfDay;
}

/**
 * TC39 `GetPossibleEpochNanoseconds` for a named zone, with 05ce7a3's clamp: the exact times whose
 * wall clock in `timeZone` is `wall`, ascending — none in a gap, two in an overlap.
 *
 * @throws RangeError when a matching exact time lies outside the representable range
 */
export function possibleEpochNanoseconds(
  timeZone: string,
  wall: Temporal.PlainDateTime,
): bigint[] {
  const isoWall = wall.withCalendar("iso8601");
  const utc = utcEpochNanoseconds(isoWall);
  const offsetBefore = offsetAt(timeZone, utc - NANOSECONDS_PER_DAY);
  const offsetAfter = offsetAt(timeZone, utc + NANOSECONDS_PER_DAY);
  const offsets =
    offsetBefore === offsetAfter ? [offsetBefore] : [offsetBefore, offsetAfter];

  const candidates: bigint[] = [];
  for (const offset of offsets) {
    const candidate = utc - offset;

    if (!isValidEpoch(candidate)) {
      if (offsetAt(timeZone, candidate) === offset) {
        throw new RangeError(
          `${isoWall.toString()} in ${timeZone} is outside the supported range`,
        );
      }
      continue;
    }

    const resolved = new Temporal.ZonedDateTime(
      candidate,
      timeZone,
    ).toPlainDateTime();
    if (Temporal.PlainDateTime.compare(resolved, isoWall) === 0) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

/** TC39 `DisambiguatePossibleEpochNanoseconds`. */
function disambiguatePossibleEpochNanoseconds(
  possible: bigint[],
  timeZone: string,
  wall: Temporal.PlainDateTime,
  disambiguation: ResolvedDisambiguation,
): bigint {
  if (possible.length === 1) return possible[0];

  if (disambiguation === "reject") {
    throw new RangeError(
      `${wall.toString()} in ${timeZone} is ambiguous or does not exist`,
    );
  }

  if (possible.length > 1) {
    return disambiguation === "later"
      ? possible[possible.length - 1]
      : possible[0];
  }

  // A gap: move the wall clock by the size of the offset change, then resolve again.
  const isoWall = wall.withCalendar("iso8601");
  const utc = utcEpochNanoseconds(isoWall);
  const shift = Number(
    offsetAt(timeZone, utc + NANOSECONDS_PER_DAY) -
      offsetAt(timeZone, utc - NANOSECONDS_PER_DAY),
  );

  const shifted =
    disambiguation === "earlier"
      ? possibleEpochNanoseconds(
          timeZone,
          isoWall.subtract({ nanoseconds: shift }),
        )
      : possibleEpochNanoseconds(timeZone, isoWall.add({ nanoseconds: shift }));

  if (shifted.length === 0) {
    throw new RangeError(
      `${wall.toString()} in ${timeZone} cannot be resolved`,
    );
  }

  return disambiguation === "earlier"
    ? shifted[0]
    : shifted[shifted.length - 1];
}

/** TC39 `GetEpochNanosecondsFor`. */
export function epochNanosecondsFor(
  timeZone: string,
  wall: Temporal.PlainDateTime,
  disambiguation: ResolvedDisambiguation,
): bigint {
  return disambiguatePossibleEpochNanoseconds(
    possibleEpochNanoseconds(timeZone, wall),
    timeZone,
    wall,
    disambiguation,
  );
}

/** TC39 `RoundNumberToIncrement(value, 1 minute, "half-expand")`. */
export function roundToMinute(nanoseconds: bigint): bigint {
  const sign = nanoseconds < 0n ? -1n : 1n;
  const magnitude = nanoseconds * sign;
  const quotient = magnitude / NANOSECONDS_PER_MINUTE;
  const remainder = magnitude % NANOSECONDS_PER_MINUTE;
  const rounded =
    remainder * 2n >= NANOSECONDS_PER_MINUTE ? quotient + 1n : quotient;

  return rounded * NANOSECONDS_PER_MINUTE * sign;
}

/** Offset nanoseconds of a UTC offset string (`"+10:00"`, `"-04:56:02"`), parsed by Temporal. */
export function utcOffsetStringNanoseconds(offset: string): bigint {
  const utcMidnight = Temporal.ZonedDateTime.from(
    { year: 1970, month: 1, day: 1, timeZone: "UTC", offset },
    { offset: "use" },
  );
  return -utcMidnight.epochNanoseconds;
}

/**
 * `Temporal.ZonedDateTime.from`.
 *
 * @param item RFC 9557 zoned string or ZonedDateTime-like property bag
 * @param options Temporal `disambiguation` / `offset` / `overflow`
 * @returns the resolved Temporal.ZonedDateTime; throws where TC39 Temporal throws
 */
export function zonedDateTimeFrom(
  item: string | Temporal.ZonedDateTimeLike,
  options?: ZonedFromOptions,
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(item, options);
}

/**
 * The first offset change strictly after `from` in a named zone, as the runtime reports it
 * (`getTimeZoneTransition("next")`).
 *
 * @param timeZone a named zone
 * @param from the instant to search after (exclusive), in epoch nanoseconds
 * @returns the change's epoch nanoseconds, or null when there is none (or `from` is past the range)
 */
export function nextTransitionAfter(
  timeZone: string,
  from: bigint,
): bigint | null {
  if (!isValidEpoch(from)) return null;
  const next = new Temporal.ZonedDateTime(from, timeZone).getTimeZoneTransition(
    "next",
  );
  return next === null ? null : next.epochNanoseconds;
}
