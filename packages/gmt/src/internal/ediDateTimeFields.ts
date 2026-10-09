// Not re-exported from `internal/index.ts`: `toOffsetInstant` reads that barrel at module top
// level (`TIME_ZONE_ANNOTATION`), so a barrel entry for this module would close a cycle and leave
// the constant undefined when `toOffsetInstant` evaluates. Import this file directly.
import { Temporal } from "@js-temporal/polyfill";
import { fromOffsetInstant } from "../instant/convert/fromOffsetInstant";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import {
  type EdiCode,
  type EdiKind,
  type EdiPart,
  type EdiStandard,
  type EdiValueKind,
  X12_TIME_GRAMMAR,
  ediCodeOfKind,
} from "./ediGrammar";

/** The digits one half of a value carries, as numbers, before Temporal has seen them. */
interface EdiFieldBag {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  /** `±HH:MM`, from the `ZHHMM` groups or from the three `ZZZ` characters. */
  offset?: string;
}

/** The members of the bag that hold a number. */
type EdiNumberField = Exclude<keyof EdiFieldBag, "offset">;

/**
 * The bag member each digit part of a mask fills. The offset parts (`ZS`, `ZH`, `ZM`) and `ZZZ`
 * are text, not numbers, and are read apart.
 */
const NUMBER_FIELD_OF_PART: Readonly<Partial<Record<EdiPart, EdiNumberField>>> =
  {
    CCYY: "year",
    MM: "month",
    DD: "day",
    HH: "hour",
    MI: "minute",
    SS: "second",
  };

/**
 * The two `ZZZ` literals that are +00:00. `UTC` is what the SMDG IFTSAI 2.0 and BAPLIE 3.1.1
 * guides write in a `303` value. `GMT` is the same scale by UN/ECE Recommendation 7 ¶12:
 * "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)".
 */
const UTC_LITERALS: readonly string[] = ["UTC", "GMT"];

/**
 * Read a single EDI date/time value against a format code of one kind, as one ISO 8601 string:
 * the reader behind every public parser of a date, a time, a local date-time and a date-time
 * with an offset.
 *
 * - The code must be one of `kind` in its standard's table (`ediGrammar.ts`); a code of another
 *   kind, a period or range code and a code that is not read return `""`.
 * - The value is tested against the code's grammar, its digits are read into a field bag, and
 *   the bag goes through `Temporal.PlainDate.from` / `PlainTime.from` / `PlainDateTime.from` with
 *   `overflow: "reject"`: the grammar proves shape, Temporal proves the date is real.
 * - A date is `YYYY-MM-DD`, a time `HH:MM:SS` and a local date-time `YYYY-MM-DDTHH:MM:SS`.
 *   Seconds are always written, `00` for a mask without them.
 * - A date-time with an offset (`205`, `208`; `303` and `304`, whose `ZZZ` is `[+-]HH`, `UTC` or
 *   `GMT`) is the wall clock as written with its offset, `YYYY-MM-DDTHH:MM:SS±HH:MM`. The wall
 *   clock and the offset are joined as an extended ISO string, read by `toOffsetInstant` and
 *   written by `fromOffsetInstant`; no offset digit is moved by hand.
 * - Never throws: any failure is `""`.
 *
 * @param standard which element the code belongs to
 * @param kind the kind of value the calling function reads
 * @param code the 2379 or 1250 format code
 * @param value the element value, after the interchange has been unescaped
 * @returns the value as one ISO 8601 string, or `""`
 *
 * @example readEdiValue("edifact", "date", "102", "20240615") // "2024-06-15"
 * @example readEdiValue("edifact", "dateTime", "203", "202406151430") // "2024-06-15T14:30:00"
 * @example readEdiValue("edifact", "offsetDateTime", "303", "202406151430+02") // "2024-06-15T14:30:00+02:00"
 * @example readEdiValue("x12", "date", "DB", "06152024") // "2024-06-15"
 * @example readEdiValue("edifact", "date", "203", "202406151430") // "" (a date-time code)
 * @example readEdiValue("edifact", "date", "102", "20230229") // "" (2023 has no 29 February)
 */
export function readEdiValue(
  standard: EdiStandard,
  kind: EdiKind,
  code: string,
  value: string,
): string {
  try {
    const halves = readHalves(ediCodeOfKind(standard, kind, code), value);
    return halves === null || halves.length !== 1 ? "" : halves[0];
  } catch {
    return "";
  }
}

/**
 * Read an EDI period or range against a format code of one kind, as its two ends: the reader
 * behind every public parser of a period (UNTDID 2379) and a range (X12 1250).
 *
 * - The code must be one of `kind`; a single-value code and a code of another kind return null.
 * - Each half is read as `readEdiValue` reads a date or a local date-time. A 2379 period is run
 *   together and a 1250 range has exactly one hyphen: the grammar holds that.
 * - An end that precedes its start returns null (**GMT rule**: a reversed period names no span
 *   of time). An end equal to its start is a valid period.
 * - Never throws: any failure is null.
 *
 * @param standard which element the code belongs to
 * @param kind the kind of period or range the calling function reads
 * @param code the 2379 or 1250 format code
 * @param value the element value
 * @returns the two ends as ISO 8601 strings, or null
 *
 * @example readEdiRange("edifact", "datePeriod", "718", "2024061520240620") // { start: "2024-06-15", end: "2024-06-20" }
 * @example readEdiRange("x12", "dateTimeRange", "RDT", "202406151430-202406201600") // { start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }
 * @example readEdiRange("x12", "dateRange", "RD8", "20240620-20240615") // null (the end precedes the start)
 * @example readEdiRange("edifact", "datePeriod", "102", "20240615") // null (a single date code)
 */
export function readEdiRange(
  standard: EdiStandard,
  kind: EdiKind,
  code: string,
  value: string,
): { start: string; end: string } | null {
  try {
    const entry = ediCodeOfKind(standard, kind, code);
    const halves = readHalves(entry, value);
    if (entry === null || halves === null || halves.length !== 2) {
      return null;
    }
    const [start, end] = halves;
    return endPrecedesStart(entry.valueKind, start, end)
      ? null
      : { start, end };
  } catch {
    return null;
  }
}

/** The digits a decimal-seconds field is padded to before it is read as milliseconds. */
const MILLISECOND_DIGITS = 3;

/**
 * Read an X12 data element 337 (Time) value as an ISO 8601 time, `HH:MM:SS[.f[f]]`.
 *
 * - The value is tested against `X12_TIME_GRAMMAR` (`HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD`) and
 *   its fields go through `Temporal.PlainTime.from` with `overflow: "reject"`.
 * - Decimal seconds become the fraction of the second exactly: one digit is tenths, two are
 *   hundredths. Temporal writes no trailing zero, so `14304550` is `14:30:45.5`.
 * - `""` for a non-string, a value of any other length or shape, hour 24, and minute or second
 *   60. Never throws.
 *
 * @param value the element 337 value as transmitted
 * @returns the time, or `""`
 *
 * @example readX12Time("1430") // "14:30:00"
 * @example readX12Time("143045") // "14:30:45"
 * @example readX12Time("14300012") // "14:30:00.12"
 * @example readX12Time("2430") // ""
 */
export function readX12Time(value: string): string {
  try {
    if (typeof value !== "string") {
      return "";
    }
    const match = X12_TIME_GRAMMAR.exec(value);
    if (match === null) {
      return "";
    }
    const [, hour, minute, second = "0", decimal = ""] = match;
    return Temporal.PlainTime.from(
      {
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second),
        // "1" is one tenth (100 ms); "12" is twelve hundredths (120 ms).
        millisecond: Number(decimal.padEnd(MILLISECOND_DIGITS, "0")),
      },
      { overflow: "reject" },
    ).toString();
  } catch {
    return "";
  }
}

/**
 * Read the date (element 373, `CCYYMMDD`) and the time (element 337) of an X12 segment as one
 * local date-time, `YYYY-MM-DDTHH:MM:SS[.f[f]]`.
 *
 * - The date is read by the `CCYYMMDD` mask of the 1250 code `D8` (one grammar, one reader) and
 *   the time by `readX12Time`; Temporal joins the two.
 * - `""` when either is missing, is not a string or is not a real date or time. Never throws.
 *
 * @param date the element 373 value as transmitted
 * @param time the element 337 value as transmitted
 * @returns the local date-time, or `""`
 *
 * @example readX12DateAndTime("20240615", "1430") // "2024-06-15T14:30:00"
 * @example readX12DateAndTime("20240615", "14300012") // "2024-06-15T14:30:00.12"
 * @example readX12DateAndTime("20240615", "") // ""
 */
export function readX12DateAndTime(date: string, time: string): string {
  try {
    const dateOnly = readEdiValue("x12", "date", "D8", date);
    const timeOnly = readX12Time(time);
    if (dateOnly === "" || timeOnly === "") {
      return "";
    }
    return Temporal.PlainDate.from(dateOnly)
      .toPlainDateTime(Temporal.PlainTime.from(timeOnly))
      .toString();
  } catch {
    return "";
  }
}

/**
 * The value as one ISO 8601 string per half: one for a single value, two for a period or range.
 * Null when there is no code, the value is not a string, it does not match the code's grammar,
 * or a half states an offset no instant can be read at. Temporal throws for a date or time that
 * is not real.
 */
function readHalves(entry: EdiCode | null, value: string): string[] | null {
  if (entry === null || typeof value !== "string") {
    return null;
  }
  const match = entry.grammar.exec(value);
  if (match === null) {
    return null;
  }
  const captures = match.slice(1);
  const { start, end } = entry.layout;
  const bags =
    end === undefined
      ? [readBag(start, captures)]
      : [
          readBag(start, captures.slice(0, start.length)),
          readBag(end, captures.slice(start.length)),
        ];
  const halves: string[] = [];
  for (const bag of bags) {
    const half = HALF_READERS[entry.valueKind](bag);
    if (half === null) {
      return null;
    }
    halves.push(half);
  }
  return halves;
}

/** The captured digits of one half, read by part name into a field bag. */
function readBag(parts: readonly EdiPart[], captures: string[]): EdiFieldBag {
  const bag: EdiFieldBag = {};
  const text: Partial<Record<EdiPart, string>> = {};
  parts.forEach((part, index) => {
    const raw = captures[index] ?? "";
    const field = NUMBER_FIELD_OF_PART[part];
    if (field === undefined) {
      text[part] = raw;
    } else {
      bag[field] = Number(raw);
    }
  });
  const offset = offsetOf(text);
  return offset === null ? bag : { ...bag, offset };
}

/**
 * The `±HH:MM` a half states: `ZS`, `ZH` and `ZM` joined, or the three `ZZZ` characters read as
 * a signed hour (UN/ECE Rec 7 ¶12, hours only) or as `UTC` or `GMT` (+00:00). The grammar
 * admits nothing else in `ZZZ`. Null for a half with no offset.
 */
function offsetOf(text: Partial<Record<EdiPart, string>>): string | null {
  if (text.ZS !== undefined) {
    return `${text.ZS}${text.ZH}:${text.ZM}`;
  }
  if (text.ZZZ === undefined) {
    return null;
  }
  return UTC_LITERALS.includes(text.ZZZ) ? "+00:00" : `${text.ZZZ}:00`;
}

/** The wall clock of a half that has a date and a time, built by Temporal from its fields. */
function localDateTime(bag: EdiFieldBag): string {
  return Temporal.PlainDateTime.from(
    {
      year: bag.year,
      month: bag.month,
      day: bag.day,
      hour: bag.hour,
      minute: bag.minute,
      second: bag.second ?? 0,
    },
    { overflow: "reject" },
  ).toString();
}

/**
 * Each kind's reader: one half's fields as the ISO 8601 string of that kind. Temporal throws for
 * a date or time that is not real; null is for an offset no instant can be read at.
 */
const HALF_READERS: Readonly<
  Record<EdiValueKind, (bag: EdiFieldBag) => string | null>
> = {
  date: (bag) =>
    Temporal.PlainDate.from(
      { year: bag.year, month: bag.month, day: bag.day },
      { overflow: "reject" },
    ).toString(),
  time: (bag) =>
    Temporal.PlainTime.from(
      { hour: bag.hour, minute: bag.minute, second: bag.second ?? 0 },
      { overflow: "reject" },
    ).toString(),
  dateTime: localDateTime,
  // The wall clock and its offset, read by `toOffsetInstant` and written back by
  // `fromOffsetInstant`: the pair's own string, so `-00:00` is `+00:00` and the result reads
  // back through the instant functions.
  offsetDateTime: (bag) => {
    const pair = toOffsetInstant(`${localDateTime(bag)}${bag.offset ?? ""}`);
    const written = pair === null ? "" : fromOffsetInstant(pair);
    return written === "" ? null : written;
  },
};

/**
 * GMT rule: a reversed period names no span of time. Two dates compare by calendar date and two
 * local date-times to the second.
 */
function endPrecedesStart(
  valueKind: EdiValueKind,
  start: string,
  end: string,
): boolean {
  return valueKind === "date"
    ? Temporal.PlainDate.compare(end, start) < 0
    : Temporal.PlainDateTime.compare(end, start) < 0;
}
