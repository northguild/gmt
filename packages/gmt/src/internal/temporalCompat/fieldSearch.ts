import { Temporal } from "@js-temporal/polyfill";
import { MAX_ISO_EPOCH_DAYS } from "../zonedWallClock";
import { calendarFieldsOf } from "./calendarFields";

/*
 * Read-only fields → ISO search. Calendar fields increase strictly with ISO order under the key
 * (year, ordinal month, day), and a read (`calendarFieldsOf`) is correct for every in-range ISO
 * date, so binary search over epoch days finds the ISO date for any fields without any calendar
 * rule. It replaces the polyfill's `calendarToIsoDate` only where that throws (defect D1).
 */

/** TC39 `ISODateWithinLimits`: -271821-04-19 is one day before -10^8 epoch days. */
const MIN_EPOCH_DAY = -(MAX_ISO_EPOCH_DAYS + 1);
const MAX_EPOCH_DAY = MAX_ISO_EPOCH_DAYS;
/** 2^64 days covers any window; the full range needs 28 halvings. */
const MAX_BISECTION_STEPS = 64;

const UNIX_EPOCH_DATE = new Temporal.PlainDate(1970, 1, 1);

export interface FieldKey {
  year: number;
  month: number;
  day: number;
}

function dateAt(epochDay: number): Temporal.PlainDate {
  return UNIX_EPOCH_DATE.add({ days: epochDay });
}

function compareKeys(a: FieldKey, b: FieldKey): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function keyAt(calendarId: string, epochDay: number): FieldKey {
  return calendarFieldsOf(dateAt(epochDay), calendarId);
}

function epochDayOf(date: Temporal.PlainDate): number {
  return UNIX_EPOCH_DATE.until(date.withCalendar("iso8601"), {
    largestUnit: "days",
  }).days;
}

/** True when `date` is the last representable date, +275760-09-13. */
export function isLastRepresentableDate(date: Temporal.PlainDate): boolean {
  return epochDayOf(date) === MAX_EPOCH_DAY;
}

/**
 * The latest in-range ISO date whose `calendarId` key is at or before `target`, or `null` when
 * `target` precedes the first representable date. Throws RangeError if the search fails to
 * converge (callers return their sentinel).
 */
export function floorDateForFields(
  calendarId: string,
  target: FieldKey,
): Temporal.PlainDate | null {
  return floorBetween(calendarId, target, MIN_EPOCH_DAY, MAX_EPOCH_DAY);
}

/**
 * `floorDateForFields` within `[from, from + days]` (clamped to the range): `null` when `target`
 * precedes `from`, the window's last date when `target` is at or past it.
 */
export function floorDateForFieldsBetween(
  calendarId: string,
  target: FieldKey,
  from: Temporal.PlainDate,
  days: number,
): Temporal.PlainDate | null {
  const low = Math.max(MIN_EPOCH_DAY, epochDayOf(from));
  return floorBetween(
    calendarId,
    target,
    low,
    Math.min(MAX_EPOCH_DAY, low + days),
  );
}

function floorBetween(
  calendarId: string,
  target: FieldKey,
  lowEpochDay: number,
  highEpochDay: number,
): Temporal.PlainDate | null {
  let low = lowEpochDay;
  let high = highEpochDay;
  if (compareKeys(keyAt(calendarId, low), target) > 0) {
    return null;
  }
  if (compareKeys(keyAt(calendarId, high), target) <= 0) {
    return dateAt(high);
  }
  // Invariant: key(low) <= target < key(high).
  for (let step = 0; step < MAX_BISECTION_STEPS; step++) {
    if (high - low <= 1) {
      return dateAt(low);
    }
    const middle = Math.floor((low + high) / 2);
    if (compareKeys(keyAt(calendarId, middle), target) <= 0) {
      low = middle;
    } else {
      high = middle;
    }
  }
  throw new RangeError(`Field search for ${calendarId} did not converge`);
}

/** The ISO date (iso8601) whose `calendarId` fields are exactly `target`, or `null`. */
export function isoForFields(
  calendarId: string,
  target: FieldKey,
): Temporal.PlainDate | null {
  const floor = floorDateForFields(calendarId, target);
  if (floor === null) {
    return null;
  }
  return compareKeys(calendarFieldsOf(floor, calendarId), target) === 0
    ? floor
    : null;
}
