/**
 * Derives "from UTC−11 to UTC+13:45" style copy from the published CI
 * timezone matrix (`gmtStats.timezoneList`), rather than typing the offsets
 * in.
 *
 * Two matrix zones observe DST (Australia/Lord_Howe, Pacific/Chatham) —
 * Samoa (Pacific/Apia) abolished it after 2021 and is now a flat +13:00
 * year round, which is why it is *not* the zone that sets the maximum
 * below, even though older, hand-typed copy on this page used to say it
 * was. A single reference instant would understate the spread on whichever
 * side of the year it lands, so instead each zone's offset is sampled on
 * the 1st of every month at noon UTC across a fixed reference year — 2025,
 * chosen only so the derived figures don't drift build to build — and the
 * min/max across those twelve samples is taken as that zone's offset
 * range. Monthly sampling is enough here: every DST zone in
 * the matrix holds its standard or daylight offset for several consecutive
 * whole months, so a month-1 sample lands inside each state at least once a
 * year. `zoneOffsetRange` then takes the widest min and the widest max
 * across every zone — the true extremes the matrix can ever show at once,
 * which is what "at any given moment" in the why-gmt copy claims.
 */
import { Temporal } from "@js-temporal/polyfill";

const REFERENCE_YEAR = 2025;
const MINUTES_PER_NANOSECOND = 1 / 60_000_000_000;

export interface ZoneOffset {
  zoneId: string;
  minutes: number;
}

export interface ZoneOffsetRange {
  min: ZoneOffset;
  max: ZoneOffset;
}

/** `zoneId`'s UTC offset, in minutes, on the 1st of `month` (1-12) at noon UTC in `year`. */
function offsetMinutesAt(zoneId: string, year: number, month: number): number {
  const instant = Temporal.Instant.from(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01T12:00:00Z`,
  );
  return (
    instant.toZonedDateTimeISO(zoneId).offsetNanoseconds *
    MINUTES_PER_NANOSECOND
  );
}

/** `zoneId`'s smallest and largest UTC offset (minutes) across `year`. */
function offsetExtremesForYear(
  zoneId: string,
  year: number,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let month = 1; month <= 12; month += 1) {
    const minutes = offsetMinutesAt(zoneId, year, month);
    min = Math.min(min, minutes);
    max = Math.max(max, minutes);
  }
  return { min, max };
}

/**
 * Across `zoneIds`, the most negative offset any zone reaches over a year
 * and the most positive — the widest window the matrix can ever produce.
 */
export function zoneOffsetRange(zoneIds: readonly string[]): ZoneOffsetRange {
  if (zoneIds.length === 0) {
    throw new Error("zoneOffsetRange: zoneIds must not be empty");
  }

  let min: ZoneOffset | undefined;
  let max: ZoneOffset | undefined;
  for (const zoneId of zoneIds) {
    const extremes = offsetExtremesForYear(zoneId, REFERENCE_YEAR);
    if (min === undefined || extremes.min < min.minutes) {
      min = { zoneId, minutes: extremes.min };
    }
    if (max === undefined || extremes.max > max.minutes) {
      max = { zoneId, minutes: extremes.max };
    }
  }
  return { min: min!, max: max! };
}

/** "UTC−11" / "UTC+14" / "UTC+5:45" — U+2212 minus sign, matching the rest of the site's offset copy. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(mins).padStart(2, "0")}`;
}
