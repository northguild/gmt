// Not re-exported from `internal/index.ts`, for the reason `ediDateTimeFields.ts` gives:
// `toOffsetInstant` reads that barrel at module top level, and the `plain/validate` functions
// import it too, so a barrel entry for this module would close a cycle. Import this file directly.
import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import { isValidDate } from "../plain/validate/isValidDate";
import { isValidDateTime } from "../plain/validate/isValidDateTime";
import { isValidTime } from "../plain/validate/isValidTime";
import {
  type EdiCode,
  type EdiKind,
  type EdiPart,
  type EdiStandard,
  type EdiValueKind,
  MILLISECONDS_PER_DECIMAL_SECOND,
  ediCodeOfKind,
  x12TimeElementLayoutOf,
} from "./ediGrammar";
import { parseUtcOffsetNanoseconds } from "./utcOffsetString";

const NANOSECONDS_PER_MINUTE = 60_000_000_000n;
const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
const MINUTES_PER_HOUR = 60n;

/** The first and last years a `CCYY` mask can hold: four digits and no sign. */
const MIN_FOUR_DIGIT_YEAR = 0;
const MAX_FOUR_DIGIT_YEAR = 9999;

/** What one half of a value states, as the Temporal objects its digits are read from. */
interface IsoHalf {
  /** The calendar date, or null when the kind has none. */
  readonly date: Temporal.PlainDate | null;
  /** The time of day on the value's own wall clock, or null when the kind has none. */
  readonly time: Temporal.PlainTime | null;
  /** Nanoseconds the wall clock runs ahead of UTC, or null when the kind has no offset. */
  readonly offset: bigint | null;
}

/** The digits (or sign) written for each part of a mask; null for a part that cannot hold its value. */
type PartText = Partial<Record<EdiPart, string | null>>;

/**
 * Write one ISO 8601 value as a single EDI date/time value in a format code of one kind: the
 * inverse of `readEdiValue`, driven by the same layout tables (`ediGrammar.ts`), so what one
 * writes the other reads back.
 *
 * - The code must be one of `kind`; a code of another kind, a period or range code and a code
 *   that is not written return `""`.
 * - The kind fixes the ISO 8601 string `value` must be, as the house plain functions fix theirs:
 *   a date is what `isValidDate` accepts, a time what `isValidTime` accepts, a local date-time
 *   what `isValidDateTime` accepts, and a date-time with an offset what `toOffsetInstant` reads
 *   (an offset, `Z`, or a bracketed zone that agrees). Temporal then reads the fields; no digit
 *   of the input is sliced.
 * - Precision is cut to the mask and never refused: a fraction of a second is dropped under
 *   every 2379 and 1250 mask (none has decimal seconds) and the seconds under a mask with no
 *   `SS`. The cut is a truncation, never a rounding, so a written value never names a later
 *   minute or second than its input.
 * - A value with an offset is written on its own wall clock, never the UTC clock. `ZHHMM` holds
 *   whole minutes and `ZZZ` whole hours, always written as the signed hour of UN/ECE
 *   Recommendation 7 ¶12 (`+02`), never `UTC` or `GMT`. An offset the field cannot hold returns
 *   `""`: rounding it would name another instant.
 * - A year outside 0000–9999 returns `""`: `CCYY` is four digits and no sign.
 * - Never throws: any failure is `""`.
 *
 * @param standard which element the code belongs to
 * @param kind the kind of value the calling function writes
 * @param code the 2379 or 1250 format code
 * @param value one ISO 8601 string of that kind
 * @returns the element value, or `""`
 *
 * @example writeEdiValue("edifact", "dateTime", "203", "2024-06-15T14:30:45") // "202406151430"
 * @example writeEdiValue("edifact", "offsetDateTime", "303", "2024-06-15T14:30:00+02:00") // "202406151430+02"
 * @example writeEdiValue("x12", "date", "DB", "2024-06-15") // "06152024"
 * @example writeEdiValue("edifact", "offsetDateTime", "303", "2024-06-15T14:30:00+05:30") // "" (ZZZ holds whole hours)
 * @example writeEdiValue("edifact", "date", "102", "2024-06-15T14:30:00") // "" (a date-time is not a date)
 */
export function writeEdiValue(
  standard: EdiStandard,
  kind: EdiKind,
  code: string,
  value: string,
): string {
  try {
    const entry = ediCodeOfKind(standard, kind, code);
    if (entry === null || entry.layout.end !== undefined) {
      return "";
    }
    return writeHalf(entry.layout.start, readHalf(entry, value)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Write two ISO 8601 values as an EDI period or range in a format code of one kind: the inverse
 * of `readEdiRange`.
 *
 * - The code must be one of `kind`; a single-value code and a code of another kind return `""`.
 * - Each end is read and written as `writeEdiValue` reads and writes a date or a local
 *   date-time. The halves are joined by what the standard transmits: nothing for UNTDID 2379,
 *   one hyphen for X12 1250.
 * - An end that precedes its start returns `""` (**GMT rule**: a reversed period names no span
 *   of time). The ends are compared as given, before either is cut to the mask, so an end 35
 *   seconds before its start is reversed under a minute mask too. An end equal to its start is
 *   written.
 * - Never throws: any failure is `""`.
 *
 * @param standard which element the code belongs to
 * @param kind the kind of period or range the calling function writes
 * @param code the 2379 or 1250 format code
 * @param start the first end, one ISO 8601 string of the kind's half
 * @param end the second end, of the same kind
 * @returns the element value, or `""`
 *
 * @example writeEdiRange("edifact", "datePeriod", "718", "2024-06-15", "2024-06-20") // "2024061520240620"
 * @example writeEdiRange("x12", "dateRange", "RD8", "2024-06-15", "2024-06-20") // "20240615-20240620"
 * @example writeEdiRange("x12", "dateRange", "RD8", "2024-06-20", "2024-06-15") // "" (the end precedes the start)
 */
export function writeEdiRange(
  standard: EdiStandard,
  kind: EdiKind,
  code: string,
  start: string,
  end: string,
): string {
  try {
    const entry = ediCodeOfKind(standard, kind, code);
    if (entry === null || entry.layout.end === undefined) {
      return "";
    }
    const first = readHalf(entry, start);
    const second = readHalf(entry, end);
    if (first === null || second === null || endPrecedesStart(first, second)) {
      return "";
    }
    const written = [
      writeHalf(entry.layout.start, first),
      writeHalf(entry.layout.end, second),
    ];
    return written.includes(null) ? "" : written.join(entry.rangeSeparator);
  } catch {
    return "";
  }
}

/**
 * Write one ISO 8601 time as an X12 data element 337 (Time) value in one of the element's four
 * forms: the inverse of `readX12Time`, driven by the same layout table (`ediGrammar.ts`), so
 * what one writes the other reads back.
 *
 * - The form is the element's own mask (`HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD`), looked up
 *   exactly and by own key. A data element 1250 code (`TM`, `TS`) and any other string return
 *   `""`.
 * - `value` is a time, as `isValidTime` accepts it; Temporal then reads the fields. No digit of
 *   the input is sliced.
 * - The form alone fixes the digits written. It is never read off the value, so the width of the
 *   field does not depend on the data: a time with no fraction is `14300000` under `HHMMSSDD`.
 * - Precision is cut to the mask and never refused: `D` is the whole tenths of the second and
 *   `DD` its whole hundredths. The cut is a truncation, never a rounding, so a written value
 *   never names a later second than its input.
 * - Never throws: any failure is `""`.
 *
 * @param form the element's mask
 * @param value one ISO 8601 time
 * @returns the element value, or `""`
 *
 * @example writeX12TimeElement("HHMMSSDD", "14:30:00.12") // "14300012"
 * @example writeX12TimeElement("HHMMSSD", "14:30:00.12") // "1430001" (cut, not rounded)
 * @example writeX12TimeElement("HHMMSSDD", "14:30") // "14300000"
 * @example writeX12TimeElement("HHMM", "14:30:45.999") // "1430"
 * @example writeX12TimeElement("TS", "14:30:45") // "" (a 1250 code, not a mask)
 * @example writeX12TimeElement("HHMM", "2024-06-15T14:30:00") // "" (a date-time is not a time)
 */
export function writeX12TimeElement(form: string, value: string): string {
  try {
    const layout = x12TimeElementLayoutOf(form);
    if (layout === null || typeof value !== "string") {
      return "";
    }
    return writeHalf(layout.start, READERS.time(value)) ?? "";
  } catch {
    return "";
  }
}

/** One ISO 8601 string read as the kind its code's halves are, or null when it is not that kind. */
function readHalf(entry: EdiCode, text: string): IsoHalf | null {
  return typeof text === "string" ? READERS[entry.valueKind](text) : null;
}

/** Each kind's reader: the public validator proves the string, then Temporal reads its fields. */
const READERS: Readonly<
  Record<EdiValueKind, (text: string) => IsoHalf | null>
> = {
  date: (text) =>
    isValidDate(text)
      ? { date: Temporal.PlainDate.from(text), time: null, offset: null }
      : null,
  time: (text) =>
    isValidTime(text)
      ? { date: null, time: Temporal.PlainTime.from(text), offset: null }
      : null,
  dateTime: (text) =>
    isValidDateTime(text)
      ? wallClockHalf(Temporal.PlainDateTime.from(text), null)
      : null,
  offsetDateTime: readOffsetDateTime,
};

/**
 * A date-time with an offset as its own wall clock and its offset. `toOffsetInstant` reads the
 * string (an offset, `Z`, or a bracketed zone that agrees), and the wall clock is the instant
 * seen at that offset, so no digit of the input is sliced.
 */
function readOffsetDateTime(text: string): IsoHalf | null {
  const pair = toOffsetInstant(text);
  if (pair === null) {
    return null;
  }
  const offset = parseUtcOffsetNanoseconds(pair.offset);
  // An offset with a non-zero seconds part fits no mask, and is not a time zone Temporal can
  // show a clock in. A seconds part of zero is already gone: the pair's offset is `±HH:MM`.
  if (offset === null || offset % NANOSECONDS_PER_MINUTE !== 0n) {
    return null;
  }
  const wallClock = Temporal.Instant.from(pair.instant)
    .toZonedDateTimeISO(pair.offset)
    .toPlainDateTime();
  return wallClockHalf(wallClock, offset);
}

function wallClockHalf(
  wallClock: Temporal.PlainDateTime,
  offset: bigint | null,
): IsoHalf {
  return {
    date: wallClock.toPlainDate(),
    time: wallClock.toPlainTime(),
    offset,
  };
}

/**
 * GMT rule: a reversed period names no span of time. The ends compare by calendar date first
 * and by time of day, to the nanosecond, when both have one.
 */
function endPrecedesStart(start: IsoHalf, end: IsoHalf): boolean {
  if (start.date === null || end.date === null) {
    return false;
  }
  const byDate = Temporal.PlainDate.compare(end.date, start.date);
  if (byDate !== 0 || start.time === null || end.time === null) {
    return byDate < 0;
  }
  return Temporal.PlainTime.compare(end.time, start.time) < 0;
}

/**
 * One half written in its mask, or null when there is no half, its year or its offset does not
 * fit the mask, or a part has no value to write. A field the mask does not have (seconds, a
 * fraction of a second, or what is below its tenths or hundredths) is left out, which is the
 * truncation.
 */
function writeHalf(
  parts: readonly EdiPart[],
  half: IsoHalf | null,
): string | null {
  if (
    half === null ||
    !maskHoldsYear(half.date) ||
    !maskHoldsOffset(parts, half.offset)
  ) {
    return null;
  }
  const text: PartText = {
    ...dateText(half.date),
    ...timeText(half.time),
    ...offsetText(half.offset),
  };
  const written = parts.map((part) => text[part] ?? null);
  return written.includes(null) ? null : written.join("");
}

/** Whether `CCYY` can hold the date's year: 0000–9999. */
function maskHoldsYear(date: Temporal.PlainDate | null): boolean {
  return (
    date === null ||
    (date.year >= MIN_FOUR_DIGIT_YEAR && date.year <= MAX_FOUR_DIGIT_YEAR)
  );
}

/** Whether the mask can hold the offset: whole minutes, or whole hours where the mask has `ZZZ`. */
function maskHoldsOffset(
  parts: readonly EdiPart[],
  offset: bigint | null,
): boolean {
  if (offset === null) {
    return true;
  }
  const step = parts.includes("ZZZ")
    ? NANOSECONDS_PER_HOUR
    : NANOSECONDS_PER_MINUTE;
  return offset % step === 0n;
}

/** The digits of each date part of a mask, read from the date's Temporal fields. */
function dateText(date: Temporal.PlainDate | null): PartText {
  return date === null
    ? {}
    : {
        CCYY: digits(date.year, 4),
        MM: digits(date.month, 2),
        DD: digits(date.day, 2),
      };
}

/**
 * The digits of each time part of a mask, read from the time's Temporal fields. The two decimal
 * parts of X12 data element 337 are the whole tenths (`SD`) and the whole hundredths (`SDD`) of
 * the second, counted from its milliseconds: 129 ms is 1 tenth and 12 hundredths. What is below
 * the part is cut, never rounded, and the microseconds and nanoseconds are below both.
 */
function timeText(time: Temporal.PlainTime | null): PartText {
  return time === null
    ? {}
    : {
        HH: digits(time.hour, 2),
        MI: digits(time.minute, 2),
        SS: digits(time.second, 2),
        SD: digits(
          Math.trunc(time.millisecond / MILLISECONDS_PER_DECIMAL_SECOND.SD),
          1,
        ),
        SDD: digits(
          Math.trunc(time.millisecond / MILLISECONDS_PER_DECIMAL_SECOND.SDD),
          2,
        ),
      };
}

/**
 * The sign, hours and minutes of an offset, and the `ZZZ` spelling: the signed hour of UN/ECE
 * Recommendation 7 ¶12, never `UTC` or `GMT` (**GMT rule**, one spelling). A zero offset is
 * written `+`.
 */
function offsetText(offset: bigint | null): PartText {
  if (offset === null) {
    return {};
  }
  const sign = offset < 0n ? "-" : "+";
  const magnitude = offset < 0n ? -offset : offset;
  const hours = digits(Number(magnitude / NANOSECONDS_PER_HOUR), 2);
  const minutes = digits(
    Number((magnitude / NANOSECONDS_PER_MINUTE) % MINUTES_PER_HOUR),
    2,
  );
  return {
    ZS: sign,
    ZH: hours,
    ZM: minutes,
    ZZZ: hours === null ? null : `${sign}${hours}`,
  };
}

/** `value` zero-padded to `width` digits, or null when it is not a whole number that fits. */
function digits(value: number, width: number): string | null {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  const text = String(value);
  return text.length > width ? null : text.padStart(width, "0");
}
