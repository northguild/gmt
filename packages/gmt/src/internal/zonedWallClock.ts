import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset, Overflow } from "../types";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";

/*
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS — two `@js-temporal/polyfill` 0.5.1 defects at the range limits
 * ---------------------------------------------------------------------------------------------
 * TC39 Temporal accepts every ZonedDateTime whose epoch nanoseconds lie within ±8.64e21, even
 * when its local wall clock runs past `+275760-09-13T00:00` (the local date may overshoot the
 * Instant range by up to a day). The polyfill fails two ways there, in every runtime GMT runs in,
 * because GMT always imports the polyfill:
 *
 * 1. **Wall clock → instant** (`GetNamedTimeZoneEpochNanoseconds`). For a wall clock whose UTC
 *    reading is past the maximum — the last *offset* hours of the range in a positive-offset
 *    zone, 10 h in Australia/Sydney, 14 h in Pacific/Kiritimati — its ±1 day offset probe is
 *    clamped to the wall clock's own UTC reading instead of to the range limit, and
 *    `Intl.DateTimeFormat#format` throws `RangeError: Invalid time value`. The same wrong clamp
 *    at the minimum, plus a `CheckISODaysRange` the spec does not have in the named-zone branch,
 *    rejects `-271821-04-19` wall clocks that resolve to valid instants.
 *    Fixed at BOTH limits on the polyfill's main branch, and in no published release yet:
 *    05ce7a3 ("Correctly handle limits in GetNamedTimeZoneEpochNanoseconds", PR #359) fixes the
 *    maximum, and 95237e0 fixes the minimum. 05ce7a3 alone is not enough: a 0.5.1 build with only
 *    05ce7a3 applied still throws for every `min.*` probe of the `zoned.A` canary group
 *    (`temporalCompat/repros.ts`), while a build of main passes all of them.
 * 2. **Start of day in a gap / next transition** (`GetNamedTimeZoneNextTransition`). Its forward
 *    scan returns `null` as soon as a two-week step would pass the maximum, without probing the
 *    remaining days, so `getTimeZoneTransition("next")` misses a transition in the last two weeks
 *    of the range, and `GetStartOfDay` then dereferences that `null`: `PlainDate.from
 *    ("+275760-09-07").toZonedDateTime("America/Santiago")` throws `TypeError: Cannot read
 *    properties of null (reading 'sign')`. This one is NOT fixed on the polyfill's main branch.
 *
 * Every GMT wall clock → instant conversion goes through this file. Each helper calls the
 * polyfill first and returns its answer whenever it has one; only when the polyfill throws (or
 * returns a transition-less `null`) for a named, non-UTC zone near the range limits does it
 * recompute the TC39 result from operations the polyfill gets right at the limits (the
 * `ZonedDateTime` constructor, `offsetNanoseconds`, `toPlainDateTime`, `PlainDate#until`,
 * `getTimeZoneTransition("previous")`). Anything else re-throws the polyfill's own error, so no
 * input the polyfill already handles changes behaviour.
 *
 * Remove each fallback once a polyfill release containing the fix is GMT's dependency floor:
 * for defect 1, both 05ce7a3 and 95237e0 (05ce7a3 alone retires nothing, since the `zoned.A`
 * `min.*` probes still fail with it); for defect 2, an upstream fix that does not exist yet (see
 * `context/domination/js-temporal-polyfill-bugs.md` § B).
 * `pnpm compat` reports when every probe of a group passes.
 * ---------------------------------------------------------------------------------------------
 */

/** Options accepted by `Temporal.ZonedDateTime.from`. */
export interface ZonedFromOptions {
  disambiguation?: Disambiguation;
  offset?: Offset;
  overflow?: Overflow;
}

type ResolvedDisambiguation = NonNullable<Disambiguation>;
type ResolvedOffsetOption = NonNullable<Offset>;

/**
 * The offset a zoned value carries: none (resolve the wall clock), a known offset, or an offset
 * whose own instant lies outside the representable range (so no in-range candidate can match it).
 */
export type CarriedOffset = "absent" | "out-of-range" | { nanoseconds: bigint };

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;
const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
/** TC39 `CheckISODaysRange`: a date may sit at most 10^8 days from the Unix epoch. */
export const MAX_ISO_EPOCH_DAYS = 100_000_000;
/**
 * Dates this many days from a range limit are the only ones either defect reaches: defect 1 needs
 * a wall clock within a day of the limit, defect 2 a transition within the scan's two-week step.
 */
const EDGE_WINDOW_DAYS = 31;
/**
 * `getTimeZoneTransition("next")` looks at most three years (366-day years) past its receiver;
 * a `null` from further than this from the maximum is the polyfill's own horizon, not defect 2.
 */
export const NEXT_TRANSITION_HORIZON_NANOSECONDS =
  BigInt(3 * 366 + EDGE_WINDOW_DAYS) * NANOSECONDS_PER_DAY;
/** Previous-transition steps walked back from the maximum instant; real zones need two or three. */
export const MAX_TRANSITIONS_BEFORE_MAXIMUM = 64;
/** Bisection steps to pin a transition to the nanosecond: 2^64 ns covers any window. */
const MAX_BISECTION_STEPS = 64;

const UNIX_EPOCH_DATE = new Temporal.PlainDate(1970, 1, 1);
const UTC_REFERENCE = new Temporal.ZonedDateTime(0n, "UTC");

/*
 * Shape-only checks on an RFC 9557 string that Temporal has already parsed (the regexes never
 * extract a value; Temporal supplies every field). Before the first `[`, a date-time string is
 * `date [T|t|space] time [offset]`; the date and time contain no `+`/`-` after the separator, so
 * the first sign after it opens the UTC offset.
 */
const TIME_SEPARATOR = /^[^[]*[Tt ]/;
const UTC_OFFSET = /^[^[]*[Tt ][^[]*[+\-−]/;
/** RFC 9557 offset with a seconds field — TC39 `ToTemporalZonedDateTime` then matches exactly. */
const UTC_OFFSET_WITH_SECONDS = /^[^[]*[Tt ][^[+\-−]*[+\-−]\d{2}:?\d{2}:?\d{2}/;

// ---------------------------------------------------------------------------------------------
// TC39 abstract operations, rebuilt from operations the polyfill gets right at the limits
// ---------------------------------------------------------------------------------------------

function epochDays(date: Temporal.PlainDate): number {
  return UNIX_EPOCH_DATE.until(date.withCalendar("iso8601"), {
    largestUnit: "day",
  }).days;
}

/** True for a date within `EDGE_WINDOW_DAYS` of either TC39 date limit. */
export function isNearRangeEdge(date: Temporal.PlainDate): boolean {
  return Math.abs(epochDays(date)) >= MAX_ISO_EPOCH_DAYS - EDGE_WINDOW_DAYS;
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
function offsetAt(timeZone: string, epochNanoseconds: bigint): bigint {
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

/** TC39 `CheckISODaysRange`. */
function checkISODaysRange(date: Temporal.PlainDate): void {
  if (Math.abs(epochDays(date)) > MAX_ISO_EPOCH_DAYS) {
    throw new RangeError(`${date.toString()} is outside the supported range`);
  }
}

/**
 * TC39 `GetPossibleEpochNanoseconds` for a named zone, with 05ce7a3's clamp: the exact times whose
 * wall clock in `timeZone` is `wall`, ascending — none in a gap, two in an overlap.
 *
 * @throws RangeError when a matching exact time lies outside the representable range
 */
function possibleEpochNanoseconds(
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

/**
 * The first instant at or after `low` whose offset is `offset`, given that `low` has a different
 * offset and `high` has `offset`: the transition between them, to the nanosecond.
 */
function transitionBetween(
  timeZone: string,
  low: bigint,
  high: bigint,
  offset: bigint,
): bigint {
  if (
    offsetAt(timeZone, high) !== offset ||
    offsetAt(timeZone, low) === offset
  ) {
    throw new RangeError(`No transition in ${timeZone} between the bounds`);
  }

  let before = low;
  let after = high;
  for (
    let step = 0;
    step < MAX_BISECTION_STEPS && after - before > 1n;
    step++
  ) {
    const middle = (before + after) / 2n;
    if (offsetAt(timeZone, middle) === offset) {
      after = middle;
    } else {
      before = middle;
    }
  }

  if (after - before > 1n) {
    throw new RangeError(`Transition in ${timeZone} not found`);
  }

  return after;
}

/**
 * TC39 `GetStartOfDay`: the first valid wall-clock time on `date` in `timeZone` — midnight, or,
 * when midnight is skipped, the transition that skips it.
 */
export function startOfDayEpochNanoseconds(
  timeZone: string,
  date: Temporal.PlainDate,
): bigint {
  const midnight = date.withCalendar("iso8601").toPlainDateTime();
  const possible = possibleEpochNanoseconds(timeZone, midnight);
  if (possible.length > 0) return possible[0];

  const utc = utcEpochNanoseconds(midnight);
  const offsetBefore = offsetAt(timeZone, utc - NANOSECONDS_PER_DAY);
  const offsetAfter = offsetAt(timeZone, utc + NANOSECONDS_PER_DAY);

  // Midnight falls in [transition + offsetBefore, transition + offsetAfter), so the transition is
  // after `midnight - offsetAfter` and at or before `midnight - offsetBefore`.
  return transitionBetween(
    timeZone,
    clampEpoch(utc - offsetAfter),
    clampEpoch(utc - offsetBefore),
    offsetAfter,
  );
}

/** TC39 `RoundNumberToIncrement(value, 1 minute, "half-expand")`. */
function roundToMinute(nanoseconds: bigint): bigint {
  const sign = nanoseconds < 0n ? -1n : 1n;
  const magnitude = nanoseconds * sign;
  const quotient = magnitude / NANOSECONDS_PER_MINUTE;
  const remainder = magnitude % NANOSECONDS_PER_MINUTE;
  const rounded =
    remainder * 2n >= NANOSECONDS_PER_MINUTE ? quotient + 1n : quotient;

  return rounded * NANOSECONDS_PER_MINUTE * sign;
}

function matchingCandidate(
  possible: bigint[],
  wall: Temporal.PlainDateTime,
  offset: CarriedOffset,
  matchMinutes: boolean,
): bigint | null {
  if (typeof offset === "string") return null;

  const utc = utcEpochNanoseconds(wall);
  for (const candidate of possible) {
    const candidateOffset = utc - candidate;
    if (
      candidateOffset === offset.nanoseconds ||
      (matchMinutes && roundToMinute(candidateOffset) === offset.nanoseconds)
    ) {
      return candidate;
    }
  }

  return null;
}

/** TC39 `InterpretISODateTimeOffset` for a named zone and a wall clock with a time of day. */
export function interpretISODateTimeOffset(
  timeZone: string,
  wall: Temporal.PlainDateTime,
  offset: CarriedOffset,
  disambiguation: ResolvedDisambiguation,
  offsetOption: ResolvedOffsetOption,
  matchMinutes: boolean,
): bigint {
  const isoWall = wall.withCalendar("iso8601");

  if (offset === "absent" || offsetOption === "ignore") {
    return epochNanosecondsFor(timeZone, isoWall, disambiguation);
  }

  if (offsetOption === "use") {
    const exact =
      offset === "out-of-range"
        ? null
        : utcEpochNanoseconds(isoWall) - offset.nanoseconds;
    if (exact === null || !isValidEpoch(exact)) {
      throw new RangeError(
        `${isoWall.toString()} is outside the supported range`,
      );
    }
    return exact;
  }

  checkISODaysRange(isoWall.toPlainDate());
  const possible = possibleEpochNanoseconds(timeZone, isoWall);
  const matched = matchingCandidate(possible, isoWall, offset, matchMinutes);
  if (matched !== null) return matched;

  if (offsetOption === "reject") {
    throw new RangeError(
      `The offset is invalid for ${isoWall.toString()} in ${timeZone}`,
    );
  }

  return disambiguatePossibleEpochNanoseconds(
    possible,
    timeZone,
    isoWall,
    disambiguation,
  );
}

// ---------------------------------------------------------------------------------------------
// Polyfill-first wrappers
// ---------------------------------------------------------------------------------------------

/** Validates Temporal options exactly as `ZonedDateTime.from` does, without resolving anything. */
function validateFromOptions(options: ZonedFromOptions | undefined): void {
  Temporal.ZonedDateTime.from(UTC_REFERENCE, options);
}

/** A zone id as Temporal canonicalizes it, from an identifier or any RFC 9557 string. */
export function timeZoneIdOf(timeZoneLike: string): string {
  return UTC_REFERENCE.withTimeZone(timeZoneLike).timeZoneId;
}

/** Offset nanoseconds of a UTC offset string (`"+10:00"`, `"-04:56:02"`), parsed by Temporal. */
export function utcOffsetStringNanoseconds(offset: string): bigint {
  const utcMidnight = Temporal.ZonedDateTime.from(
    { year: 1970, month: 1, day: 1, timeZone: "UTC", offset },
    { offset: "use" },
  );
  return -utcMidnight.epochNanoseconds;
}

/** The epoch nanoseconds of a zoned string near the range limits, or null when out of scope. */
function stringEpochAtEdge(
  item: string,
  timeZone: string,
  wall: Temporal.PlainDateTime,
  options: ZonedFromOptions | undefined,
): bigint {
  if (!TIME_SEPARATOR.test(item)) {
    return startOfDayEpochNanoseconds(timeZone, wall.toPlainDate());
  }

  const disambiguation = options?.disambiguation ?? "compatible";
  if (!UTC_OFFSET.test(item)) {
    return epochNanosecondsFor(timeZone, wall, disambiguation);
  }

  let offset: CarriedOffset;
  try {
    offset = {
      nanoseconds:
        utcEpochNanoseconds(wall) -
        Temporal.Instant.from(item).epochNanoseconds,
    };
  } catch {
    // The grammar is already proven valid, so only the string's own instant can be out of range.
    offset = "out-of-range";
  }

  return interpretISODateTimeOffset(
    timeZone,
    wall,
    offset,
    disambiguation,
    options?.offset ?? "reject",
    !UTC_OFFSET_WITH_SECONDS.test(item),
  );
}

function fromStringAtEdge(
  item: string,
  options: ZonedFromOptions | undefined,
): Temporal.ZonedDateTime | null {
  let wall: Temporal.PlainDateTime;
  let timeZone: string;
  try {
    validateFromOptions(options);
    // A `Z` string throws here: its exact time never touches tz data, so it is never recovered.
    wall = Temporal.PlainDateTime.from(item);
    timeZone = timeZoneIdOf(item);
  } catch {
    return null;
  }

  if (!isNamedTimeZone(timeZone) || !isNearRangeEdge(wall.toPlainDate())) {
    return null;
  }

  const epoch = stringEpochAtEdge(
    item,
    timeZone,
    wall.withCalendar("iso8601"),
    options,
  );
  return new Temporal.ZonedDateTime(epoch, timeZone, wall.calendarId);
}

/** The offset a property bag carries, parsed by Temporal itself. */
function bagOffset(offset: string | undefined): CarriedOffset {
  return offset === undefined
    ? "absent"
    : { nanoseconds: utcOffsetStringNanoseconds(offset) };
}

function fromBagAtEdge(
  item: Temporal.ZonedDateTimeLike,
  options: ZonedFromOptions | undefined,
): Temporal.ZonedDateTime | null {
  let wall: Temporal.PlainDateTime;
  let timeZone: string;
  let offset: CarriedOffset;
  try {
    validateFromOptions(options);
    wall = Temporal.PlainDateTime.from(item, { overflow: options?.overflow });
    timeZone = timeZoneIdOf(String(item.timeZone));
    offset = bagOffset(item.offset);
  } catch {
    return null;
  }

  if (!isNamedTimeZone(timeZone) || !isNearRangeEdge(wall.toPlainDate())) {
    return null;
  }

  const epoch = interpretISODateTimeOffset(
    timeZone,
    wall,
    offset,
    options?.disambiguation ?? "compatible",
    options?.offset ?? "reject",
    false,
  );
  return new Temporal.ZonedDateTime(epoch, timeZone, wall.calendarId);
}

/**
 * `Temporal.ZonedDateTime.from`, correct across the whole representable range.
 *
 * Returns the polyfill's result whenever it has one. When the polyfill throws for a named zone
 * within a month of either range limit, the TC39 result is recomputed (see the note at the top
 * of this file); every other failure re-throws the polyfill's own error.
 *
 * @param item RFC 9557 zoned string or ZonedDateTime-like property bag
 * @param options Temporal `disambiguation` / `offset` / `overflow`
 * @returns the resolved Temporal.ZonedDateTime; throws where TC39 Temporal throws
 */
export function zonedDateTimeFrom(
  item: string | Temporal.ZonedDateTimeLike,
  options?: ZonedFromOptions,
): Temporal.ZonedDateTime {
  try {
    return Temporal.ZonedDateTime.from(item, options);
  } catch (error) {
    const recovered =
      typeof item === "string"
        ? fromStringAtEdge(item, options)
        : fromBagAtEdge(item, options);

    if (recovered === null) {
      throw error;
    }

    return recovered;
  }
}
