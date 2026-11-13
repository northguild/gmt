import { Temporal } from "./temporal";
import type { FixPrecision, FixUtcTimestamp } from "../types/fix";
import { isoYearString } from "./isoYearString";
import { MAX_FOUR_DIGIT_YEAR, type UtcReading } from "./utcReading";
import { LEAP_SECOND_STEPS, taiOfUtc } from "./leapSeconds";

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

/** `FIX_FRACTION_DIGITS` the other way round. A test checks that the two agree. */
const PRECISION_OF_DIGITS = {
  0: "second",
  3: "millisecond",
  6: "microsecond",
  9: "nanosecond",
  12: "picosecond",
} as const satisfies Readonly<Record<0 | 3 | 6 | 9 | 12, FixPrecision>>;

/**
 * The precision a fraction digit count states.
 *
 * @param count digits after the period, one of the counts `FIX_UTC_TIMESTAMP` matches
 * @returns the precision
 *
 * @example fixPrecisionOfDigits(3) // "millisecond"
 * @example fixPrecisionOfDigits(12) // "picosecond"
 */
export function fixPrecisionOfDigits(count: 0 | 3 | 6 | 9 | 12): FixPrecision {
  return PRECISION_OF_DIGITS[count];
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
  // fallow-ignore-next-line code-duplication -- two parsers read the same six numbered fields into different result shapes
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
 * The ISO instant text of matched FIX fields, `YYYY-MM-DDTHH:MM:SS[.d…]Z`, written from the digits
 * as sent: the second stays `60`, and a 12-digit fraction keeps its first nine digits. Nothing is
 * checked here; check the fields with `Temporal.PlainDateTime.from(…, { overflow: "reject" })`
 * first. The year needs no check: the grammar gives four digits, and a FIX stamp is already UTC.
 *
 * @param fields the fields from `readFixUtcFields`
 * @returns the instant string
 *
 * @example fixInstantText(readFixUtcFields("20240615-14:30:00.100")!) // "2024-06-15T14:30:00.100Z"
 * @example fixInstantText(readFixUtcFields("20161231-23:59:60")!) // "2016-12-31T23:59:60Z"
 */
export function fixInstantText(fields: FixUtcFields): string {
  const two = (n: number): string => String(n).padStart(2, "0");
  const three = (n: number): string => String(n).padStart(3, "0");
  const digits = Math.min(fields.fractionDigits, 9);
  const fraction =
    digits === 0
      ? ""
      : `.${three(fields.millisecond)}${three(fields.microsecond)}${three(fields.nanosecond)}`.slice(
          0,
          digits + 1,
        );
  return `${String(fields.year).padStart(4, "0")}-${two(fields.month)}-${two(fields.day)}T${two(fields.hour)}:${two(fields.minute)}:${two(fields.second)}${fraction}Z`;
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

/**
 * The core of `parseFixUtcTimestamp` and `isValidFixUtcTimestamp`: one `UTCTimestamp` read into
 * its instant, precision, leap-second flag and picoseconds. Never throws.
 *
 * @param value a FIX `UTCTimestamp` such as `20240315-12:30:45.123`
 * @returns the reading, or `null` when `value` is not a real UTCTimestamp
 *
 * @example readFixUtcTimestamp("20240315-12:30:45.123") // an instant, precision and flags
 * @example readFixUtcTimestamp("20240230-12:30:45") // null
 */
export function readFixUtcTimestamp(value: string): FixUtcTimestamp | null {
  try {
    const fields = readFixUtcFields(value);
    if (fields === null) {
      return null;
    }
    // MAR-16 rule 2: a second of 60 never reaches Temporal; it goes in as 59 with a flag.
    const secondSixty = fields.second === 60;
    // Throws, and so returns null, for 30 February, hour 24, minute 60 or month 13.
    const plain = Temporal.PlainDateTime.from(
      {
        year: fields.year,
        month: fields.month,
        day: fields.day,
        hour: fields.hour,
        minute: fields.minute,
        second: secondSixty ? 59 : fields.second,
        millisecond: fields.millisecond,
        microsecond: fields.microsecond,
        nanosecond: fields.nanosecond,
      },
      { overflow: "reject" },
    );
    // Only for a 60: taiOfUtc is null before 1972 for an ordinary second too, and FIX allows 0000.
    if (
      secondSixty &&
      taiOfUtc(LEAP_SECOND_STEPS, {
        epochNanoseconds: plain.toZonedDateTime("UTC").epochNanoseconds,
        secondSixty,
      }) === null
    ) {
      return null;
    }
    return {
      instant: fixInstantText(fields),
      precision: fixPrecisionOfDigits(fields.fractionDigits),
      leapSecond: secondSixty,
      picoseconds: fields.picoseconds,
    };
  } catch {
    return null;
  }
}
