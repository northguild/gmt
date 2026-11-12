// Re-exported from `internal/index.ts` (all of its symbols); the CCSDS ASCII functions import it from there.
import { Temporal } from "./temporal";
import { isoYearString } from "./isoYearString";
import { LEAP_SECOND_STEPS, taiOfUtc } from "./leapSeconds";
import { MAX_FOUR_DIGIT_YEAR, type UtcReading } from "./utcReading";

/**
 * CCSDS 301.0-B-4 §3.5.1.1, Code A: `YYYY-MM-DDThh:mm:ss.d→dZ`. Shape only, and the seconds field
 * 00-60; month, day, hour and minute ranges are left to Temporal's `overflow: "reject"`. `\d`
 * matches only 0-9, so full-width and other-script digits are refused, and with no `m` flag `$`
 * does not match before a trailing newline. A period needs one or more digits and no digits drops
 * the period (§3.5.1.3 c); `Z` is optional.
 */
export const CCSDS_ASCII_A: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):([0-5]\d|60)(?:\.(\d+))?Z?$/;

/** CCSDS 301.0-B-4 §3.5.1.2, Code B: `YYYY-DDDThh:mm:ss.d→dZ`. */
export const CCSDS_ASCII_B: RegExp =
  /^(\d{4})-(\d{3})T(\d{2}):(\d{2}):([0-5]\d|60)(?:\.(\d+))?Z?$/;

/** The time-of-day subfields of a matched code, before any check. */
export interface CcsdsTimeFields {
  readonly hour: number;
  readonly minute: number;
  /** 0 to 60, as sent. */
  readonly second: number;
  /** The fraction digits as sent, up to the ninth; "" when the code has none. */
  readonly fraction: string;
}

/** The fields of a matched Code A. */
export type CcsdsAsciiAFields = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
} & CcsdsTimeFields;

/** The fields of a matched Code B. */
export type CcsdsAsciiBFields = {
  readonly year: number;
  /** As written, 0 to 999; the range check against the year's length is the caller's. */
  readonly dayOfYear: number;
} & CcsdsTimeFields;

/** Digits kept from a fraction: Temporal's nanosecond resolution; later digits are dropped. */
const MAX_FRACTION_DIGITS = 9;

/**
 * Read the fields of a CCSDS ASCII Code A from the grammar's own captures. No calendar check.
 * Year `0000` is refused (§3.5.1.1 `YYYY` "values 0001-9999"). Digits after the ninth are dropped.
 *
 * @param value candidate string
 * @returns the fields, or null for a non-string, a non-match or year 0000
 *
 * @example readCcsdsAsciiA("1988-01-18T17:20:43.123456Z") // { year: 1988, month: 1, day: 18, …, fraction: "123456" }
 * @example readCcsdsAsciiA("1988-018T17:20:43Z") // null
 */
export function readCcsdsAsciiA(value: unknown): CcsdsAsciiAFields | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = CCSDS_ASCII_A.exec(value);
  if (match === null || Number(match[1]) === 0) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    fraction: (match[7] ?? "").slice(0, MAX_FRACTION_DIGITS),
  };
}

/**
 * Read the fields of a CCSDS ASCII Code B from the grammar's own captures. No calendar check; the
 * day of year is returned as written, `000` and `999` included. Year `0000` is refused.
 *
 * @param value candidate string
 * @returns the fields, or null for a non-string, a non-match or year 0000
 *
 * @example readCcsdsAsciiB("1988-018T17:20:43.123456Z") // { year: 1988, dayOfYear: 18, …, fraction: "123456" }
 * @example readCcsdsAsciiB("1988-01-18T17:20:43Z") // null
 */
export function readCcsdsAsciiB(value: unknown): CcsdsAsciiBFields | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = CCSDS_ASCII_B.exec(value);
  if (match === null || Number(match[1]) === 0) {
    return null;
  }
  return {
    year: Number(match[1]),
    dayOfYear: Number(match[2]),
    hour: Number(match[3]),
    minute: Number(match[4]),
    second: Number(match[5]),
    fraction: (match[6] ?? "").slice(0, MAX_FRACTION_DIGITS),
  };
}

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * The UTC instant text of a checked date and the time fields, `YYYY-MM-DDThh:mm:ss[.d…]Z`, written
 * from the digits as sent: trailing zeros stay and a second of 60 stays 60. Throws where Temporal
 * throws (hour 24, minute 60), so call it inside `try`.
 *
 * @param date the calendar date, already built with `overflow: "reject"`
 * @param time the time-of-day fields from a reader
 * @returns the instant string, or "" when a second of 60 names no inserted leap second
 *
 * @example ccsdsInstantText(Temporal.PlainDate.from("2016-12-31"), { hour: 23, minute: 59, second: 60, fraction: "" }) // "2016-12-31T23:59:60Z"
 * @example ccsdsInstantText(Temporal.PlainDate.from("2024-06-30"), { hour: 23, minute: 59, second: 60, fraction: "" }) // ""
 */
export function ccsdsInstantText(
  date: Temporal.PlainDate,
  time: CcsdsTimeFields,
): string {
  const secondSixty = time.second === 60;
  const nanos = time.fraction.padEnd(MAX_FRACTION_DIGITS, "0");
  const plain = Temporal.PlainDateTime.from(
    {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
      second: secondSixty ? 59 : time.second,
      millisecond: Number(nanos.slice(0, 3)),
      microsecond: Number(nanos.slice(3, 6)),
      nanosecond: Number(nanos.slice(6, 9)),
    },
    { overflow: "reject" },
  );
  if (
    secondSixty &&
    taiOfUtc(LEAP_SECOND_STEPS, {
      epochNanoseconds: plain.toZonedDateTime("UTC").epochNanoseconds,
      secondSixty: true,
    }) === null
  ) {
    return "";
  }
  const fraction = time.fraction === "" ? "" : `.${time.fraction}`;
  return `${isoYearString(date.year)}-${two(date.month)}-${two(date.day)}T${two(time.hour)}:${two(time.minute)}:${two(time.second)}${fraction}Z`;
}

/** `hh:mm:ss[.f]` of a reading and its UTC wall clock; throws where Temporal throws. */
function ccsdsTimeText(
  wall: Temporal.PlainDateTime,
  reading: UtcReading,
  digits: unknown,
): string {
  const time = wall.toPlainTime().toString({
    fractionalSecondDigits:
      digits as Temporal.ToStringPrecisionOptions["fractionalSecondDigits"],
    roundingMode: "trunc",
  });
  return reading.secondSixty ? `${time.slice(0, 6)}60${time.slice(8)}` : time;
}

/** The UTC wall clock of a reading, or null for a year outside 0001-9999. */
function ccsdsWall(reading: UtcReading): Temporal.PlainDateTime | null {
  const wall = Temporal.Instant.fromEpochNanoseconds(reading.epochNanoseconds)
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();
  return wall.year < 1 || wall.year > MAX_FOUR_DIGIT_YEAR ? null : wall;
}

/**
 * The CCSDS ASCII Code A text of a UTC reading: `YYYY-MM-DDThh:mm:ss[.d…]Z`, the fraction cut and
 * never rounded. `digits` goes to Temporal's `fractionalSecondDigits` untouched. Throws where
 * Temporal throws (an invalid `digits`), so call it inside `try`.
 *
 * @param reading the UTC reading
 * @param digits `"auto"`, undefined or 0 to 9, as Temporal reads it
 * @returns the Code A text, or "" for a UTC year outside 0001-9999
 *
 * @example ccsdsCodeAText({ epochNanoseconds: 0n, secondSixty: false }, 3) // "1970-01-01T00:00:00.000Z"
 */
export function ccsdsCodeAText(reading: UtcReading, digits: unknown): string {
  const wall = ccsdsWall(reading);
  if (wall === null) {
    return "";
  }
  return `${isoYearString(wall.year)}-${two(wall.month)}-${two(wall.day)}T${ccsdsTimeText(wall, reading, digits)}Z`;
}

/**
 * The CCSDS ASCII Code B text of a UTC reading: `YYYY-DDDThh:mm:ss[.d…]Z`. Otherwise as
 * `ccsdsCodeAText`.
 *
 * @param reading the UTC reading
 * @param digits `"auto"`, undefined or 0 to 9, as Temporal reads it
 * @returns the Code B text, or "" for a UTC year outside 0001-9999
 *
 * @example ccsdsCodeBText({ epochNanoseconds: 0n, secondSixty: false }, 0) // "1970-001T00:00:00Z"
 */
export function ccsdsCodeBText(reading: UtcReading, digits: unknown): string {
  const wall = ccsdsWall(reading);
  if (wall === null) {
    return "";
  }
  return `${isoYearString(wall.year)}-${String(wall.dayOfYear).padStart(3, "0")}T${ccsdsTimeText(wall, reading, digits)}Z`;
}
