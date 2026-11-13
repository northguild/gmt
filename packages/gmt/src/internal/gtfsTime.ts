/*
 * The GTFS Schedule `Time` value (`25:35:00`): `HH:MM:SS`, with `H:MM:SS` and `HHH:MM:SS` also
 * read, whose hour runs past 23 for a time after midnight on the same service day. Private: the
 * public check is `isValidGtfsTime(value)`, never a pattern.
 *
 * Source: GTFS Schedule Reference, revised 27 April 2026, from MobilityData's `google/transit`
 * repository (`gtfs/spec/en/reference.md`), published at
 * https://gtfs.org/documentation/schedule/reference/
 * - § Field Types, Time: "Time in the HH:MM:SS format (H:MM:SS is also accepted)"; "For times
 *   occurring after midnight on the service day, enter the time as a value greater than 24:00:00
 *   in HH:MM:SS"; "`25:35:00` for 1:35AM on the next day".
 * - § File Requirements: "Extra spaces between fields or field names should be removed", "Field
 *   values must not contain tabs, carriage returns or new lines" and "Files that include the
 *   Unicode byte-order mark (BOM) character are acceptable": a BOM belongs to the file reader.
 *
 * GMT rules:
 * - Hours 0-999 in one to three digits, minutes and seconds 00-59. GTFS states no upper bound for
 *   the hour; real feeds write three digits (VIA Rail Canada's `110:29:00`) and MobilityData's
 *   gtfs-validator reads one to three. Minutes and seconds are clock fields, and a GTFS time is
 *   an offset from a local anchor, not a UTC reading, so there is no second 60.
 * - Digits are ASCII only: the grammar writes `[0-9]`, not `\d`.
 * - Nothing is trimmed and no byte order mark is stripped (a GMT rule resting on the clauses
 *   above); the caller's CSV reader does that.
 * - No Temporal call: a GTFS time names no date and its hour runs past 23, so there is nothing
 *   for Temporal to check that a pattern and two integer comparisons do not.
 */

/** Seconds in a GTFS day: the unit `dayOverflow` counts. */
export const SECONDS_PER_DAY = 86_400;
/** The largest hour three digits can write. */
export const GTFS_MAX_HOUR = 999;

// No `i`, `m`, `u` or `g` flag: `$` then fails before a trailing newline, and `exec` stays
// stateless.
const GTFS_TIME = /^([0-9]{1,3}):([0-9]{2}):([0-9]{2})$/;

/**
 * The fields of an `H:MM:SS`, `HH:MM:SS` or `HHH:MM:SS` value, as numbers: hours 0-999, minutes
 * and seconds 0-99.
 */
export interface GtfsTimeFields {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Read the fields of a GTFS time, or null when the shape does not match. Checks shape only. */
export function readGtfsTimeFields(value: string): GtfsTimeFields | null {
  const match = GTFS_TIME.exec(value);
  if (match === null) return null;
  const [, hh, mm, ss] = match as unknown as [string, string, string, string];
  return { hours: Number(hh), minutes: Number(mm), seconds: Number(ss) };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Write `HH:MM:SS`, each field padded to at least two digits. The caller checks the ranges. */
export function writeGtfsTime(
  hours: number,
  minutes: number,
  seconds: number,
): string {
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}
