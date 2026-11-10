import {
  fixInstantText,
  fixPrecisionOfDigits,
  LEAP_SECOND_STEPS,
  readFixUtcFields,
  taiOfUtc,
} from "../../internal";
import { Temporal } from "../../internal/temporal";
import type { FixUtcTimestamp } from "../../types/fix";

/**
 * Read a FIX `UTCTimestamp` as a UTC instant and the precision its digits state.
 *
 * - The format is `YYYYMMDD-HH:MM:SS` or `YYYYMMDD-HH:MM:SS.fraction`. FIX Latest: "colons, dash,
 *   and period required"; "The fractions of seconds may be empty when no fractions of seconds are
 *   conveyed (in such a case the period is not conveyed)". A period needs digits.
 * - The fraction digits state the precision (FIX Latest: "3 digits to convey milliseconds, 6
 *   digits to convey microseconds, 9 digits to convey nanoseconds, 12 digits to convey
 *   picoseconds"):
 *
 *   | Fraction digits | `precision`     |
 *   | --------------- | --------------- |
 *   | none            | `"second"`      |
 *   | 3               | `"millisecond"` |
 *   | 6               | `"microsecond"` |
 *   | 9               | `"nanosecond"`  |
 *   | 12              | `"picosecond"`  |
 *
 * - Precision is reported, never widened: `instant` keeps the digits sent, trailing zeros
 *   included, so `.100` stays `.100Z`.
 * - Temporal holds nanoseconds. For a 12-digit fraction the first nine digits go in `instant`
 *   and the last three in `picoseconds`; nothing is dropped.
 * - A second of `60` is read only for one of the 27 inserted leap seconds in the IERS table
 *   built into GMT (Leap_Second.dat through Bulletin C 72; the table is closed). `instant` is
 *   then `…T23:59:60…Z`, which `formatFixUtcTimestamp`, `toTAI` and `isLeapSecond` read back
 *   and other GMT functions refuse. A `60` on any other day, at any other hour or minute, or
 *   before 1972 returns `null`.
 * - Fields are checked, not clamped: 30 February, hour 24, minute 60 and month 13 return `null`.
 *   The year is the four digits as written, `0000` to `9999`.
 * - Another number of digits is FIX's "bilateral agreement" and returns `null`; read it with
 *   `parseDateTimeWithPattern` or your own code, knowing the agreed precision.
 * - Which FIX field carries the stamp (`SendingTime`, `TransactTime`) is the FIX dictionary's
 *   concern, not this function's.
 * - Returns `null` for a non-string argument.
 *
 * @param value A FIX `UTCTimestamp` (e.g. "20240615-14:30:00.123")
 * @returns the instant, precision, leap-second flag and picoseconds, or `null` on invalid input
 *
 * @example parseFixUtcTimestamp("20240615-14:30:00.123456") // { instant: "2024-06-15T14:30:00.123456Z", precision: "microsecond", leapSecond: false, picoseconds: 0 }
 * @example parseFixUtcTimestamp("20240615-14:30:00") // { instant: "2024-06-15T14:30:00Z", precision: "second", leapSecond: false, picoseconds: 0 }
 * @example parseFixUtcTimestamp("20240615-14:30:00.123456789012") // { instant: "2024-06-15T14:30:00.123456789Z", precision: "picosecond", leapSecond: false, picoseconds: 12 }
 * @example parseFixUtcTimestamp("20161231-23:59:60") // { instant: "2016-12-31T23:59:60Z", precision: "second", leapSecond: true, picoseconds: 0 }
 * @example parseFixUtcTimestamp("20171231-23:59:60") // null (no leap second was inserted on 2017-12-31)
 * @example parseFixUtcTimestamp("20240615-14:30:00.12") // null (2 digits: FIX names no precision for it)
 * @example parseFixUtcTimestamp("20240230-00:00:00") // null (2024 has no 30 February)
 */
export function parseFixUtcTimestamp(value: string): FixUtcTimestamp | null {
  try {
    const fields = readFixUtcFields(value);
    if (fields === null) {
      return null;
    }
    const precision = fixPrecisionOfDigits(fields.fractionDigits);
    if (precision === null) {
      return null;
    }
    // MAR-16 rule 2: a second of 60 never reaches Temporal; it goes in as 59 with a flag.
    const secondSixty = fields.second === 60;
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
    const reading = {
      epochNanoseconds: plain.toZonedDateTime("UTC").epochNanoseconds,
      secondSixty,
    };
    // Only for a 60: taiOfUtc is null before 1972 for an ordinary second too, and FIX allows 0000.
    if (secondSixty && taiOfUtc(LEAP_SECOND_STEPS, reading) === null) {
      return null;
    }
    const instant = fixInstantText(
      reading,
      Math.min(fields.fractionDigits, 9) as 0 | 3 | 6 | 9,
    );
    if (instant === "") {
      return null;
    }
    return {
      instant,
      precision,
      leapSecond: secondSixty,
      picoseconds: fields.picoseconds,
    };
  } catch {
    return null;
  }
}
