import { epochDayOf, isoFieldsOf } from "../../internal/epochDay";
import { floorDivide } from "../../internal/floorDivide";
import { parseInstantNanoseconds } from "../../internal/instantNanoseconds";
import { readMetarTimeFields } from "../../internal/metarTime";
import { Temporal } from "../../internal/temporal";
import {
  isValidEpoch,
  utcEpochNanoseconds,
} from "../../internal/zonedWallClock";

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
 * Parse a METAR report-time group as an ISO 8601 UTC instant, read against a reference instant.
 *
 * - **What it reads.** The `YYGGggZ` group that opens a METAR, a SPECI and a TAF's issue time:
 *   day of month, hour and minute in UTC, then `Z` with no space (`251200Z`). Upper-case `Z`
 *   only, ASCII digits only. Day 01–31, hour 00–23, minute 00–59; `24` is not read.
 * - **A reference is required.** The group has no month or year, and the function never uses
 *   "now": a stored report reads the same every month. Pass the time the report was received,
 *   or the archive's timestamp.
 * - **How the month is chosen.** The result is the nearer, in exact elapsed time, of the latest
 *   candidate at or before the reference and the earliest after it. A month that lacks the day
 *   (31 in a 30-day month, 29 to 31 in February) is skipped. Of two equally near candidates the
 *   earlier wins. There is no distance limit; check staleness with `spanNs`.
 * - **UTC throughout.** Months are counted in UTC whatever the reference's offset, and the result
 *   always ends in `Z`. No local wall time is resolved, so no disambiguation policy applies.
 * - **Sources.** WMO-No. 306 FM 15 reg. 15.3.1 and 15.3.2 (METAR, SPECI), FM 51 reg. 51.1.2 (TAF
 *   issue time) and the symbolic letters `YY` and `GGggZ`. ICAO Annex 3 Appendix 3 was not reached.
 *
 * @param value A METAR time group, `YYGGggZ` (e.g. "251200Z")
 * @param referenceInstant An ISO 8601 instant with `Z` or an offset: the time the report was received or the archive's timestamp
 * @returns the ISO instant ("2024-06-25T12:00:00Z"), or "" on invalid input
 *
 * @example parseMetarTime("251200Z", "2024-06-25T12:20:00Z") // "2024-06-25T12:00:00Z"
 * @example parseMetarTime("302350Z", "2024-07-01T00:05:00Z") // "2024-06-30T23:50:00Z"
 * @example parseMetarTime("312350Z", "2024-07-01T00:05:00Z") // "2024-05-31T23:50:00Z" (June has no 31st)
 * @example parseMetarTime("312350Z", "2025-01-01T00:05:00Z") // "2024-12-31T23:50:00Z"
 * @example parseMetarTime("010010Z", "2024-06-30T23:55:00Z") // "2024-07-01T00:10:00Z"
 * @example parseMetarTime("151200Z", "2024-06-30T12:00:00Z") // "2024-06-15T12:00:00Z" (a tie: the earlier)
 * @example parseMetarTime("251200", "2024-06-25T12:20:00Z") // ""
 * @example parseMetarTime("251200Z", "2024-06-25T12:20:00") // ""
 */
export function parseMetarTime(
  value: string,
  referenceInstant: string,
): string {
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
