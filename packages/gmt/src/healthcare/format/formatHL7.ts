import {
  hl7PrecisionRank,
  isoHl7Form,
  isoHl7Precision,
  isoStringBody,
  isOptionsArgument,
  parseUtcOffsetNanoseconds,
  readFormOffsetInstant,
} from "../../internal";
import { isDateString, plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";
import type { Hl7FormatOptions, Hl7Precision } from "../../types";

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;

// 2.A.22 picture `YYYY…`: four digits and no sign.
const MIN_FOUR_DIGIT_YEAR = 0;
const MAX_FOUR_DIGIT_YEAR = 9999;

// 2.A.22 picture `[.S[S[S[S]]]]`: a fraction of one to four digits.
const MAX_FRACTION_DIGITS = 4;

/**
 * Write an ISO 8601 string as an HL7 v2 date-time (`DTM`): the inverse of `parseHL7`.
 *
 * HL7 v2.5.1 2.A.22 (headed 2.A.1.22 in the hl7.eu v2.5.1 copy) defines the `DTM`
 * `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]` and says "the number of characters populated
 * (excluding the time zone specification) specifies the precision".
 *
 * | Input form | Written precision | Example result |
 * | --- | --- | --- |
 * | `2024` | year | `2024` |
 * | `2024-06` | month | `202406` |
 * | `2024-06-15` | day | `20240615` |
 * | `2024-06-15T10` | hour | `2024061510` |
 * | `2024-06-15T10:30` / `…:00` / `…:00.f` | minute / second / fraction | `202406151030` / `20240615103000` / `20240615103000.f` |
 * | the same with `Z` or `±HH:MM`, with or without a bracketed zone | as written, then `±HHMM` | `20240615103000-0500` |
 *
 * - The precision is read from the form the input is written in; `options.precision` only lowers
 *   it, and a finer one returns `""`. A value is cut to its precision and never rounded, so the
 *   result never names a later minute, hour or day than the input. A fraction is cut to four
 *   digits, the most 2.A.22 allows.
 * - It never writes `TS`: v2.6 2.A.77 says it was "withdrawn and removed from the standard as of
 *   v 2.6", so the result never holds `^`.
 * - A value with no offset writes none, and the HL7 value then means the sender's local time
 *   (2.A.22: "if the time zone is not included, the time zone defaults to that of the local time
 *   zone of the sender"). To send a facility's wall clock with its offset, pass the string
 *   `fromOffsetInstant` writes for that zone.
 * - The offset written is the one `toOffsetInstant` reads: the one written, or the zone's when a
 *   zone annotation follows `Z` (`…Z[Europe/Helsinki]` writes `+0300`); `Z` alone writes `+0000`.
 *   It is never dropped and never rounded: an offset that is not a whole number of minutes
 *   returns `""`.
 * - `Z` and `-00:00` (RFC 9557 §2.2: UTC known, local offset unknown) write `+0000`; HL7 has no
 *   spelling for an unknown offset (2.A.22: "+0000 or -0000 both represent UTC").
 * - A date with an offset is not ISO 8601 and returns `""`. An hour with one is ISO 8601-1
 *   §5.3.1.3 reduced precision and is written (`2024-06-15T10-05:00` is `2024061510-0500`). To
 *   write a date with its offset, pass the instant with `precision`:
 *   `formatHL7("2024-06-15T10:30:00-05:00", { precision: "day" })` is `20240615-0500`.
 * - Disambiguation: none. The function never converts a wall time without an offset to an
 *   instant, and a zone annotation with no offset (`2024-06-15T10:30:00[Europe/Helsinki]`)
 *   returns `""`: resolve it first with `resolveLocal` or `toOffsetInstant(value, zone)`.
 * - Annotations: on a form with no offset, any bracketed annotation returns `""`
 *   (`2024-06-15[u-ca=iso8601]`, `…T10:30:00[foo=bar]`). On a form with an offset, `[u-ca=…]`,
 *   `[!u-ca=…]` and an unknown non-critical key are ignored and the ISO digits are written, while
 *   a critical unknown key (`[!foo=bar]`) returns `""`.
 * - A minute-precision `local` from `parseHL7` reads back with `:00` seconds; to write the same
 *   digits, pass `{ precision: result.precision }`.
 * - A year outside 0000–9999 returns `""`.
 * - Never throws: any failure, for input of any type, is `""`.
 *
 * @param value ISO 8601 date, date-time, or date-time with an offset
 * @param options How much of the value is written
 * @returns the `DTM`, or `""` when the value cannot be written
 *
 * @example formatHL7("2024-06-15T10:30:00-05:00") // "20240615103000-0500"
 * @example formatHL7("2024-06-15T15:30:00Z") // "20240615153000+0000"
 * @example formatHL7("2024-06-15T10:30:00") // "20240615103000" (the sender's local time)
 * @example formatHL7("2024-06-15T10:30:45.98765-05:00") // "20240615103045.9876-0500" (cut, not rounded)
 * @example formatHL7("2024-06-15T10:30:45.98765-05:00", { precision: "day" }) // "20240615-0500"
 * @example formatHL7("2024-06", { precision: "day" }) // "" (finer than the value carries)
 * @example formatHL7("2024-06-15T10-05:00") // "2024061510-0500" (an hour with an offset)
 * @example formatHL7("2024-06-15-05:00") // "" (not ISO 8601)
 * @example formatHL7("2024-06-15T10:30:00[Europe/Helsinki]") // "" (a zone with no offset)
 * @example formatHL7("2024-02-30") // "" (no such day)
 */
export function formatHL7(value: string, options?: Hl7FormatOptions): string {
  try {
    if (typeof value !== "string" || !isOptionsArgument(options)) {
      return "";
    }
    const match = isoHl7Form.exec(isoStringBody(value));
    const form = match === null ? null : planForm(value, match, options);
    if (match === null || form === null) {
      return "";
    }
    const { target, written, fractionDigits, hasOffset } = form;
    const read = hasOffset
      ? readOffsetForm(value, written)
      : readLocalForm(value, match, written);
    if (read === null) {
      return "";
    }
    const { wallClock, offset } = read;
    if (
      wallClock.year < MIN_FOUR_DIGIT_YEAR ||
      wallClock.year > MAX_FOUR_DIGIT_YEAR
    ) {
      return "";
    }
    const offsetText = offset === null ? "" : writeOffset(offset);
    if (offsetText === null) {
      return "";
    }
    return writeDigits(wallClock, target, fractionDigits) + offsetText;
  } catch {
    // Never throws (Core Rule 3)
    return "";
  }
}

interface FormPlan {
  readonly target: Hl7Precision;
  readonly written: Hl7Precision;
  readonly fractionDigits: number;
  readonly hasOffset: boolean;
}

/** The precisions of a form and the checks that need no Temporal; null when the form is refused. */
function planForm(
  value: string,
  match: RegExpExecArray,
  options: Hl7FormatOptions | undefined,
): FormPlan | null {
  const requested = options?.precision;
  if (requested !== undefined && hl7PrecisionRank(requested) < 0) {
    return null;
  }
  const { precision: written, fractionDigits } = isoHl7Precision(match);
  const hasOffset = match.groups?.["offset"] !== undefined;
  if (!isWritableForm(value, hasOffset)) {
    return null;
  }
  const target = requested ?? written;
  if (hl7PrecisionRank(target) > hl7PrecisionRank(written)) {
    return null;
  }
  return { target, written, fractionDigits, hasOffset };
}

/**
 * A zone with no offset needs a disambiguation choice this function does not make. (A date with
 * an offset is not ISO 8601, and `isoHl7Form` has already refused it.)
 */
function isWritableForm(value: string, hasOffset: boolean): boolean {
  return hasOffset || !value.includes("[");
}

interface WallClockRead {
  readonly wallClock: Temporal.PlainDateTime;
  /** The offset string of the value, or null for a local form. */
  readonly offset: string | null;
}

/** A form with no offset: Temporal reads the fields, with `overflow: "reject"`. */
function readLocalForm(
  value: string,
  match: RegExpExecArray,
  written: Hl7Precision,
): WallClockRead | null {
  const groups = match.groups as Record<string, string | undefined>;
  const reject = { overflow: "reject" } as const;
  const own = isoStringBody(value);
  let wallClock: Temporal.PlainDateTime;
  switch (written) {
    case "year":
      wallClock = Temporal.PlainDate.from(
        { year: Number(groups["year"]), month: 1, day: 1 },
        reject,
      ).toPlainDateTime();
      break;
    case "month": {
      const month = Temporal.PlainYearMonth.from(own);
      wallClock = month.toPlainDate({ day: 1 }).toPlainDateTime();
      break;
    }
    case "day":
      if (!isDateString(own)) {
        return null;
      }
      wallClock = Temporal.PlainDate.from(own).toPlainDateTime();
      break;
    case "hour":
      wallClock = Temporal.PlainDateTime.from(
        {
          year: Number(groups["year"]),
          month: Number(groups["month"]),
          day: Number(groups["day"]),
          hour: Number(groups["hour"]),
        },
        reject,
      );
      break;
    default: {
      const dateTime = plainDateTimeOf(own);
      if (dateTime === null) {
        return null;
      }
      wallClock = dateTime;
    }
  }
  return { wallClock, offset: null };
}

/**
 * A form with an offset: `readFormOffsetInstant` reads it as `toOffsetInstant` does, an hour-only
 * time included, and the wall clock is the instant seen at that offset.
 */
function readOffsetForm(
  value: string,
  written: Hl7Precision,
): WallClockRead | null {
  const pair = readFormOffsetInstant(value, written);
  if (pair === null) {
    return null;
  }
  const wallClock = Temporal.Instant.from(pair.instant)
    .toZonedDateTimeISO(pair.offset)
    .toPlainDateTime();
  return { wallClock, offset: pair.offset };
}

/** `±HHMM` from whole minutes, or null for an offset that is not a whole number of minutes. */
function writeOffset(offset: string): string | null {
  const nanoseconds = parseUtcOffsetNanoseconds(offset);
  if (nanoseconds === null || nanoseconds % NANOSECONDS_PER_MINUTE !== 0n) {
    return null;
  }
  const magnitude = nanoseconds < 0n ? -nanoseconds : nanoseconds;
  const hours = magnitude / NANOSECONDS_PER_HOUR;
  const minutes = (magnitude % NANOSECONDS_PER_HOUR) / NANOSECONDS_PER_MINUTE;
  return `${nanoseconds < 0n ? "-" : "+"}${hours.toString().padStart(2, "0")}${minutes
    .toString()
    .padStart(2, "0")}`;
}

/** The digits `YYYY` … `SS[.S…]` of the wall clock up to the target precision: a cut, never a rounding. */
function writeDigits(
  wallClock: Temporal.PlainDateTime,
  target: Hl7Precision,
  fractionDigits: number,
): string {
  const pad = (n: number, width: number): string =>
    String(n).padStart(width, "0");
  const rank = hl7PrecisionRank(target);
  const parts = [
    pad(wallClock.year, 4),
    pad(wallClock.month, 2),
    pad(wallClock.day, 2),
    pad(wallClock.hour, 2),
    pad(wallClock.minute, 2),
    pad(wallClock.second, 2),
  ];
  let text = parts.slice(0, Math.min(rank + 1, parts.length)).join("");
  if (target === "fraction") {
    const subSecond =
      pad(wallClock.millisecond, 3) +
      pad(wallClock.microsecond, 3) +
      pad(wallClock.nanosecond, 3);
    text += `.${subSecond.slice(0, Math.min(MAX_FRACTION_DIGITS, fractionDigits))}`;
  }
  return text;
}
