import { Temporal } from "./temporal";
import type { DateTimeDurationUnit } from "../types";
import { durationTotal } from "./zonedWallClockDifference";
import { readDurationUnits } from "./readDurationUnits";
import { addToZoned, subtractFromZoned } from "./zonedWallClockOperations";
import {
  frameInstant,
  frameZoned,
  zoneFrame,
  type ZoneFrame,
} from "./zoneFrame";

/**
 * A `units` argument as a length: `readDurationUnits`, then null if any amount is below zero.
 * `-0` is not below zero, so it stays a zero length.
 *
 * @param units the caller's `units` argument
 * @param isAllowed type guard for the units the calling function takes
 * @returns the unit amounts, or null on invalid input or a negative amount
 *
 * @example readLengthUnits({ days: 1 }, isValidDateTimeDurationUnit) // { days: 1 }
 * @example readLengthUnits({ days: -1 }, isValidDateTimeDurationUnit) // null
 */
export function readLengthUnits<Unit extends DateTimeDurationUnit>(
  units: unknown,
  isAllowed: (unit: string) => unit is Unit,
): Partial<Record<Unit, number>> | null {
  const amounts = readDurationUnits(units, isAllowed);
  if (amounts === null) {
    return null;
  }
  return (Object.values(amounts) as number[]).some((amount) => amount < 0)
    ? null
    : amounts;
}

/**
 * The instant `amounts` after `start`, counted on `frame`'s wall clock.
 *
 * Pure: it reads no clock, and the caller passes its own start. A missing calendar day clamps
 * (TC39 Temporal `AddZonedDateTime`, `overflow: "constrain"`); a wall time in a gap moves later
 * and a repeated one takes the earlier (`"compatible"`). Throws what Temporal throws, for
 * example `RangeError` past its range; the public wrapper catches.
 *
 * @param start the instant the length is counted from
 * @param amounts the length as a unit object
 * @param frame the frame whose wall clock calendar units count on
 * @returns the instant the length ends
 *
 * @example addLengthToStart(Temporal.Instant.from("2027-06-15T12:00:00Z"), { days: 90 }, zoneFrame("UTC")).toString() // "2027-09-13T12:00:00Z"
 */
export function addLengthToStart(
  start: Temporal.Instant,
  amounts: Partial<Record<DateTimeDurationUnit, number>>,
  frame: ZoneFrame,
): Temporal.Instant {
  return frameInstant(
    addToZoned(frameZoned(start, frame), amounts, { overflow: "constrain" }),
    frame,
  );
}

/**
 * The length of `amounts` from `start`, in `unit`, fractional and unrounded.
 *
 * Pure, and it throws what Temporal throws; the public wrapper catches. Calendar units are
 * measured from `start` on `frame`'s wall clock (TC39 Temporal `Duration.prototype.total` with a
 * zoned `relativeTo`).
 *
 * @param start the instant the length is counted from
 * @param amounts the length as a unit object
 * @param unit the Temporal unit to total in
 * @param frame the frame whose wall clock calendar units count on
 * @returns the total in `unit`
 *
 * @example totalLengthFromStart(Temporal.Instant.from("2027-06-15T12:00:00Z"), { years: 1 }, "seconds", zoneFrame("UTC")) // 31622400
 */
export function totalLengthFromStart(
  start: Temporal.Instant,
  amounts: Partial<Record<DateTimeDurationUnit, number>>,
  unit: string,
  frame: ZoneFrame,
): number {
  return durationTotal(
    Temporal.Duration.from(amounts),
    unit as Temporal.TotalUnit<Temporal.DateTimeUnit>,
    frameZoned(start, frame),
  );
}

/**
 * Whole seconds from `now` to `target`, rounded toward positive infinity. Never `-0`.
 *
 * @param target the instant counted to
 * @param now the instant counted from
 * @returns whole seconds, negative when `target` is a second or more past
 *
 * @example wholeSecondsUntil(Temporal.Instant.from("2027-06-15T12:01:00Z"), Temporal.Instant.from("2027-06-15T12:00:00Z")) // 60
 */
export function wholeSecondsUntil(
  target: Temporal.Instant,
  now: Temporal.Instant,
): number {
  const ns = target.epochNanoseconds - now.epochNanoseconds;
  const whole = ns / 1_000_000_000n;
  return Number(ns % 1_000_000_000n > 0n ? whole + 1n : whole);
}

/**
 * The instant `amounts` before `start`, counted on `frame`'s wall clock.
 *
 * Pure, like `addLengthToStart`: it reads no clock and throws what Temporal throws. A missing
 * calendar day clamps (`overflow: "constrain"`), as `subtractFromZoned` does for `subtract*`.
 *
 * @param start the instant the length is counted back from
 * @param amounts the length as a unit object
 * @param frame the frame whose wall clock calendar units count on
 * @returns the instant the length begins
 *
 * @example subtractLengthFromStart(Temporal.Instant.from("2027-06-15T12:00:00Z"), { days: 90 }, zoneFrame("UTC")).toString() // "2027-03-17T12:00:00Z"
 */
export function subtractLengthFromStart(
  start: Temporal.Instant,
  amounts: Partial<Record<DateTimeDurationUnit, number>>,
  frame: ZoneFrame,
): Temporal.Instant {
  return frameInstant(
    subtractFromZoned(frameZoned(start, frame), amounts, {
      overflow: "constrain",
    }),
    frame,
  );
}

/**
 * Whole milliseconds from `now` to `target`, rounded toward positive infinity. Never `-0`.
 *
 * @param target the instant counted to
 * @param now the instant counted from
 * @returns whole milliseconds, negative when `target` is a millisecond or more past
 *
 * @example wholeMillisecondsUntil(Temporal.Instant.from("2027-06-15T12:00:01Z"), Temporal.Instant.from("2027-06-15T12:00:00Z")) // 1000
 */
export function wholeMillisecondsUntil(
  target: Temporal.Instant,
  now: Temporal.Instant,
): number {
  const ns = target.epochNanoseconds - now.epochNanoseconds;
  const whole = ns / 1_000_000n;
  return Number(ns % 1_000_000n > 0n ? whole + 1n : whole);
}

/**
 * The UTC frame that unix, UTC and from-now lengths count on.
 *
 * A function, not a module constant, so the file keeps no top-level work.
 *
 * @returns the frame for `"UTC"`
 *
 * @example utcLengthFrame().timeZone // "UTC"
 */
export function utcLengthFrame(): ZoneFrame {
  return zoneFrame("UTC") as ZoneFrame;
}
