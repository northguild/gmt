import { Temporal } from "./temporal";
import type { GnssSystem } from "../types/gnss";
import { MAX_FOUR_DIGIT_YEAR, secondSixtyWallClock } from "./utcReading";

/**
 * The token naming a time scale: `TAI` (FITS 4.0 §9.2.1 Table 30) or one of the six RINEX 4.02
 * §5.2.8 time-system identifiers.
 */
export type TimeScaleToken = "TAI" | GnssSystem;

/**
 * A time-scale string: an ISO 8601 extended local date-time, one space, and the token naming the
 * scale (`2026-01-01T00:00:37 TAI`). Four-digit year, `T`, seconds required, 1 to 9 fraction digits
 * after `.` (RFC 3339 §5.6 `time-secfrac`; Temporal's nanosecond resolution). Tokens: FITS 4.0
 * Table 30 (`TAI`) and RINEX 4.02 §5.2.8 (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`). Joining the
 * date-time and the token with a space is a GMT rule: no standard joins the two.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 hour, 5 minute, 6 second, 7 fraction digits, 8 token.
 * A match proves shape only; `parseTimeScaleString` hands the fields to Temporal.
 */
export const timeScaleString: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))? (TAI|GPS|GAL|BDT|QZS|GLO|IRN)$/;

/** A time scale's wall clock, read as if UTC, and whether its second field was 60. */
export interface TimeScaleLabel {
  /** The scale's wall clock as UTC epoch nanoseconds; for second 60, the `…:59.f` label. */
  readonly labelNanoseconds: bigint;
  /** Whether the label's second field is 60 (only `GLO`, which keeps UTC's leap seconds). */
  readonly secondSixty: boolean;
}

/**
 * Read a time-scale string written with `token`.
 *
 * - The regex proves shape; the fields go to `Temporal.PlainDateTime.from(fields, { overflow:
 *   "reject" })`, so a date or time that does not exist is refused.
 * - A second of 60 is refused for every token but `GLO`, whose labels are UTC's own wall clock
 *   (RINEX 4.02 §4.1.2). For `GLO` it is read as 59 with `secondSixty` set; whether that second
 *   was inserted is checked against the leap-second table later.
 *
 * @param value candidate time-scale string
 * @param token the token the string must carry
 * @returns the label, or null when `value` is not a valid time-scale string with that token
 */
export function parseTimeScaleString(
  value: unknown,
  token: TimeScaleToken,
): TimeScaleLabel | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = timeScaleString.exec(value);
  if (match === null || match[8] !== token) {
    return null;
  }

  const second = Number(match[6]);
  if (second > 60 || (second === 60 && token !== "GLO")) {
    return null;
  }
  const digits = match[7] ?? "";
  const fraction =
    digits === "" ? 0 : Number(digits) * 10 ** (9 - digits.length);

  try {
    const wall = Temporal.PlainDateTime.from(
      {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        hour: Number(match[4]),
        minute: Number(match[5]),
        second: second === 60 ? 59 : second,
        millisecond: Math.floor(fraction / 1e6),
        microsecond: Math.floor(fraction / 1e3) % 1000,
        nanosecond: fraction % 1000,
      },
      { overflow: "reject" },
    );
    return {
      labelNanoseconds: wall.toZonedDateTime("UTC").epochNanoseconds,
      secondSixty: second === 60,
    };
  } catch {
    return null;
  }
}

/**
 * Write a label as a time-scale string with `token`, the fraction in Temporal's shortest digits.
 * A second-60 label is written `…T23:59:60[.fraction] <token>`.
 *
 * @param label the scale's wall clock as label nanoseconds
 * @param token the token to write
 * @returns the time-scale string, or "" for a year outside 0000–9999 or when Temporal throws
 */
export function formatTimeScaleString(
  label: TimeScaleLabel,
  token: TimeScaleToken,
): string {
  try {
    const wall = Temporal.Instant.fromEpochNanoseconds(label.labelNanoseconds)
      .toZonedDateTimeISO("UTC")
      .toPlainDateTime();
    if (wall.year < 0 || wall.year > MAX_FOUR_DIGIT_YEAR) {
      return "";
    }
    const written = label.secondSixty
      ? secondSixtyWallClock(label.labelNanoseconds)
      : wall.toString();
    return `${written} ${token}`;
  } catch {
    return "";
  }
}
