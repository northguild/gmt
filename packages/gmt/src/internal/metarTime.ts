/*
 * The METAR report-time group `YYGGggZ` (`251200Z`): a two-digit day of month, two digits of hour,
 * two digits of minute, all UTC, then the letter `Z` with no space. Private: a group names no
 * month or year, so it is an instant only against a reference; the public check is
 * `isValidMetarTime(value, referenceInstant)`, never a pattern.
 *
 * Sources:
 * - WMO-No. 306 (2011, updated 2013), Vol. I.1 Part A, FM 15 reg. 15.3.1: "The day of the month
 *   and the time of observation in hours and minutes UTC followed, without a space, by the letter
 *   indicator Z shall be included in each individual METAR report"; reg. 15.3.2 says the same
 *   for SPECI.
 * - FM 51 reg. 51.1.2: a TAF's issue time is the same group (`YYGGggZ`).
 * - Symbolic letters `YY` ("Day of the month (UTC), with 01 indicating the first day") and
 *   `GGggZ` ("in hours and minutes UTC, followed by the letter Z").
 * - ICAO Annex 3, Appendix 3 was not reached.
 *
 * GMT rules:
 * - Letters upper case only (`Z`, never `z`); digits ASCII only: the grammar writes `[0-9]`,
 *   not `\d`.
 * - The reader checks the shape, not the time: day `00` and `32`, hour `24` and minute `60` come
 *   back as fields, and the parser rejects them.
 */

import { epochDayOf, isoFieldsOf } from "./epochDay";
import { floorDivide } from "./floorDivide";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { Temporal } from "./temporal";
import { isValidEpoch, utcEpochNanoseconds } from "./zonedWallClock";

/** The fields of a `YYGGggZ` group, as numbers: day 0–99, hour 0–99, minute 0–99 (shape only). */
export interface MetarTimeFields {
  day: number;
  hour: number;
  minute: number;
}

// No flags: `$` then fails before a trailing newline. Fixed-width classes, so linear time.
const METAR_TIME = /^([0-9]{2})([0-9]{2})([0-9]{2})Z$/;

/** Read the fields of a `YYGGggZ` group, or null when the shape does not match. */
export function readMetarTimeFields(value: string): MetarTimeFields | null {
  const match = METAR_TIME.exec(value);
  if (match === null) return null;
  const [, dd, hh, mm] = match as unknown as [string, string, string, string];
  return { day: Number(dd), hour: Number(hh), minute: Number(mm) };
}

const NS_PER_MINUTE = 60_000_000_000n;
const NS_PER_HOUR = 60n * NS_PER_MINUTE;
const NS_PER_DAY = 24n * NS_PER_HOUR;

/** The instant of `day` `hour`:`minute` UTC in a month, or null when the month lacks the day or the instant is out of range. */
function candidate(
  year: number,
  month: number,
  day: number,
  timeNs: bigint,
): bigint | null {
  const epochDay = epochDayOf(year, month, day);
  const [y, m, d] = isoFieldsOf(epochDay);
  // `epochDayOf` rolls an overflowing day into the next month, so the day exists only if it round-trips.
  if (y !== year || m !== month || d !== day) return null;
  const ns = BigInt(epochDay) * NS_PER_DAY + timeNs;
  return isValidEpoch(ns) ? ns : null;
}

/**
 * The core of `parseMetarTime` and `isValidMetarTime`: the instant a `YYGGggZ` group names, in the
 * month nearest `referenceInstant` that has the day, or `""`. Never throws.
 *
 * @example readMetarTime("151200Z", "2024-03-16T00:00:00Z") // "2024-03-15T12:00:00Z"
 * @example readMetarTime("151260Z", "2024-03-16T00:00:00Z") // ""
 */
export function readMetarTime(value: string, referenceInstant: string): string {
  try {
    if (typeof value !== "string" || typeof referenceInstant !== "string") {
      return "";
    }
    const fields = readMetarTimeFields(value);
    if (fields === null) {
      return "";
    }
    const { day, hour, minute } = fields;
    if (day < 1 || day > 31) {
      return "";
    }
    Temporal.PlainTime.from({ hour, minute }, { overflow: "reject" });
    const reference = parseInstantNanoseconds(referenceInstant);
    if (reference === null) {
      return "";
    }

    const timeNs = BigInt(hour) * NS_PER_HOUR + BigInt(minute) * NS_PER_MINUTE;
    const [year, month] = isoFieldsOf(
      Number(floorDivide(reference, NS_PER_DAY)),
    );

    // Bounded by a constant: a day missing from a month is missing only in February or a 30-day
    // month, never in two adjacent months, so the nearest month with the day is at most 2 away.
    let before: bigint | null = null;
    for (let k = 0; k >= -2 && before === null; k--) {
      const index = year * 12 + (month - 1) + k;
      const c = candidate(
        Math.floor(index / 12),
        (((index % 12) + 12) % 12) + 1,
        day,
        timeNs,
      );
      if (c !== null && c <= reference) before = c;
    }
    let after: bigint | null = null;
    for (let k = 0; k <= 2 && after === null; k++) {
      const index = year * 12 + (month - 1) + k;
      const c = candidate(
        Math.floor(index / 12),
        (((index % 12) + 12) % 12) + 1,
        day,
        timeNs,
      );
      if (c !== null && c > reference) after = c;
    }

    let chosen: bigint;
    if (before !== null && after !== null) {
      chosen = reference - before <= after - reference ? before : after;
    } else if (before !== null) {
      chosen = before;
    } else if (after !== null) {
      chosen = after;
    } else {
      return "";
    }

    const chosenDay = Number(floorDivide(chosen, NS_PER_DAY));
    const [y, m, d] = isoFieldsOf(chosenDay);
    const wall = Temporal.PlainDateTime.from(
      { year: y, month: m, day: d, hour, minute },
      { overflow: "reject" },
    );
    return Temporal.Instant.fromEpochNanoseconds(
      utcEpochNanoseconds(wall),
    ).toString();
  } catch {
    return "";
  }
}
