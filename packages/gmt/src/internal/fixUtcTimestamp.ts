// Re-exported from `internal/index.ts` (all of its symbols); the FIX functions import it from there.
import { Temporal } from "./temporal";
import type { FixPrecision } from "../types/fix";
import { isoYearString } from "./isoYearString";
import {
  MAX_FOUR_DIGIT_YEAR,
  secondSixtyWallClock,
  type UtcReading,
} from "./utcReading";

/**
 * FIX `UTCTimestamp`: date, dash, time with colons, optional period and 3, 6, 9 or 12 digits
 * (FIX Latest, `UTCTimestamp`). Shape only, and the seconds field 00-60; month, day, hour and
 * minute ranges are left to Temporal's `overflow: "reject"`. `\d` without the `u` flag is ASCII
 * only, and with no `m` flag `$` does not match before a trailing newline.
 */
export const FIX_UTC_TIMESTAMP: RegExp =
  /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):([0-5]\d|60)(?:\.(\d{3}|\d{6}|\d{9}|\d{12}))?$/;

/** Fraction digits by precision (FIX Latest: 3 milli-, 6 micro-, 9 nano-, 12 picoseconds). */
export const FIX_FRACTION_DIGITS: Readonly<
  Record<FixPrecision, 0 | 3 | 6 | 9 | 12>
> = {
  second: 0,
  millisecond: 3,
  microsecond: 6,
  nanosecond: 9,
  picosecond: 12,
};

/**
 * The precision a fraction digit count states.
 *
 * @param count digits after the period
 * @returns the precision, or null for any count FIX does not name
 *
 * @example fixPrecisionOfDigits(3) // "millisecond"
 * @example fixPrecisionOfDigits(4) // null
 */
export function fixPrecisionOfDigits(count: number): FixPrecision | null {
  switch (count) {
    case 0:
      return "second";
    case 3:
      return "millisecond";
    case 6:
      return "microsecond";
    case 9:
      return "nanosecond";
    case 12:
      return "picosecond";
    default:
      return null;
  }
}

/**
 * A precision name, singular or plural.
 *
 * @param value candidate precision
 * @returns the singular precision, or null
 *
 * @example resolveFixPrecision("milliseconds") // "millisecond"
 * @example resolveFixPrecision("toString") // null
 */
export function resolveFixPrecision(value: unknown): FixPrecision | null {
  if (typeof value !== "string") {
    return null;
  }
  switch (value) {
    case "second":
    case "seconds":
      return "second";
    case "millisecond":
    case "milliseconds":
      return "millisecond";
    case "microsecond":
    case "microseconds":
      return "microsecond";
    case "nanosecond":
    case "nanoseconds":
      return "nanosecond";
    case "picosecond":
    case "picoseconds":
      return "picosecond";
    default:
      return null;
  }
}

/** The fields of a matched value, before any calendar check. */
export interface FixUtcFields {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 to 60, as sent. */
  readonly second: number;
  readonly fractionDigits: 0 | 3 | 6 | 9 | 12;
  /** Fraction digits 1 to 3, 0 when absent. */
  readonly millisecond: number;
  /** Fraction digits 4 to 6. */
  readonly microsecond: number;
  /** Fraction digits 7 to 9. */
  readonly nanosecond: number;
  /** Fraction digits 10 to 12, 0 unless the fraction has 12 digits. */
  readonly picoseconds: number;
}

/**
 * Read the fields of a FIX `UTCTimestamp` from the grammar's own captures. No calendar check.
 *
 * @param value candidate string
 * @returns the fields, or null for a non-string or a value that does not match the grammar
 *
 * @example readFixUtcFields("20240615-14:30:00.123456789012") // { …, millisecond: 123, picoseconds: 12 }
 * @example readFixUtcFields("20240615T14:30:00") // null
 */
export function readFixUtcFields(value: unknown): FixUtcFields | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = FIX_UTC_TIMESTAMP.exec(value);
  if (match === null) {
    return null;
  }
  const fraction = (match[7] ?? "").padEnd(12, "0");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    fractionDigits: (match[7] ?? "").length as 0 | 3 | 6 | 9 | 12,
    millisecond: Number(fraction.slice(0, 3)),
    microsecond: Number(fraction.slice(3, 6)),
    nanosecond: Number(fraction.slice(6, 9)),
    picoseconds: Number(fraction.slice(9, 12)),
  };
}

const NANOSECONDS_PER_SECOND = 1_000_000_000n;

/** The sub-second count as nine digits; floor modulo, so a pre-1970 instant shows its wall clock. */
function nineDigitFraction(nanoseconds: bigint): string {
  return String(
    ((nanoseconds % NANOSECONDS_PER_SECOND) + NANOSECONDS_PER_SECOND) %
      NANOSECONDS_PER_SECOND,
  ).padStart(9, "0");
}

/**
 * The ISO instant text of a UTC reading with exactly `digits` fraction digits: `YYYY-MM-DDTHH:MM:SS[.d…]Z`,
 * the second `60` for a leap reading. Throws where Temporal throws, so call it inside `try`.
 *
 * @param reading the UTC reading
 * @param digits fraction digits to write: 0, 3, 6 or 9 (cut, never rounded)
 * @returns the instant string, or "" for a year outside 0000-9999
 *
 * @example fixInstantText({ epochNanoseconds: 1718461800123000000n, secondSixty: false }, 3) // "2024-06-15T14:30:00.123Z"
 */
export function fixInstantText(
  reading: UtcReading,
  digits: 0 | 3 | 6 | 9,
): string {
  const instant = Temporal.Instant.fromEpochNanoseconds(
    reading.epochNanoseconds,
  );
  const year = instant.toZonedDateTimeISO("UTC").year;
  if (year < 0 || year > MAX_FOUR_DIGIT_YEAR) {
    return "";
  }
  if (!reading.secondSixty) {
    return instant.toString({ fractionalSecondDigits: digits });
  }
  const wall = secondSixtyWallClock(reading.epochNanoseconds);
  const head = wall.slice(0, wall.indexOf(":60") + 3);
  const fraction =
    digits === 0
      ? ""
      : `.${nineDigitFraction(reading.epochNanoseconds).slice(0, digits)}`;
  return `${head}${fraction}Z`;
}

/**
 * The FIX text of a UTC reading at a precision: `YYYYMMDD-HH:MM:SS[.fraction]`, cut and never
 * rounded; `picosecond` pads `000`. Throws where Temporal throws, so call it inside `try`.
 *
 * @param reading the UTC reading
 * @param precision how many fraction digits to write
 * @returns the FIX text, or "" for a year outside 0000-9999
 *
 * @example fixTimestampText({ epochNanoseconds: -1n, secondSixty: false }, "nanosecond") // "19691231-23:59:59.999999999"
 */
export function fixTimestampText(
  reading: UtcReading,
  precision: FixPrecision,
): string {
  const wall = Temporal.Instant.fromEpochNanoseconds(
    reading.epochNanoseconds,
  ).toZonedDateTimeISO("UTC");
  if (wall.year < 0 || wall.year > MAX_FOUR_DIGIT_YEAR) {
    return "";
  }
  const two = (n: number): string => String(n).padStart(2, "0");
  const seconds = reading.secondSixty ? "60" : two(wall.second);
  const head = `${isoYearString(wall.year)}${two(wall.month)}${two(wall.day)}-${two(wall.hour)}:${two(wall.minute)}:${seconds}`;
  const digits = FIX_FRACTION_DIGITS[precision];
  if (digits === 0) {
    return head;
  }
  const fraction = nineDigitFraction(reading.epochNanoseconds).slice(
    0,
    Math.min(digits, 9),
  );
  return `${head}.${fraction}${digits === 12 ? "000" : ""}`;
}
