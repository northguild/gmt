// Not re-exported from `internal/index.ts`: `toOffsetInstant` reads that barrel at module top
// level (`TIME_ZONE_ANNOTATION`), so a barrel entry for this module would close a cycle and leave
// the constant undefined when `toOffsetInstant` evaluates. Import this file directly.
import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "../instant/convert/toOffsetInstant";
import type { EdiDateTime, EdiPeriodEnd } from "../types/edi";
import {
  type EdiLayout,
  type EdiPart,
  type EdiStandard,
  X12_TIME_GRAMMAR,
  ediCodeOf,
} from "./ediGrammar";
import { twoDigitYear } from "./twoDigitYear";
import { formatUtcOffset, parseUtcOffsetNanoseconds } from "./utcOffsetString";
import { readYearWindowStart } from "./yearWindowStart";

/** The digits one half of a value carries, as numbers, before Temporal has seen them. */
interface EdiFieldBag {
  year?: number;
  yy?: number;
  yearDigit?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  dayOfYear?: number;
  /** `±HH:MM` composed from the `ZHHMM` groups; not yet normalised. */
  offset?: string;
  /** The raw three-character `ZZZ`. */
  zone?: string;
}

/** The members of the bag that hold a number. */
type EdiNumberField = Exclude<keyof EdiFieldBag, "offset" | "zone">;

/**
 * The bag member each digit part of a mask fills. The offset parts (`ZS`, `ZH`, `ZM`) and `ZZZ`
 * are text, not numbers, and are read apart.
 */
const NUMBER_FIELD_OF_PART: Readonly<Partial<Record<EdiPart, EdiNumberField>>> =
  {
    CCYY: "year",
    YY: "yy",
    Y: "yearDigit",
    MM: "month",
    DD: "day",
    HH: "hour",
    MI: "minute",
    SS: "second",
    DDD: "dayOfYear",
  };

/** `[+-]HH`: the `ZZZ` form that is a signed hour of offset (UN/ECE Rec 7 ¶12, hours only). */
const HOURS_ONLY_OFFSET = /^[+-](?:[01][0-9]|2[0-3])$/;
/**
 * The two `ZZZ` literals that are +00:00. `UTC` is what the SMDG IFTSAI 2.0 and BAPLIE 3.1.1
 * guides write in a `303` value. `GMT` is the same scale by UN/ECE Recommendation 7 ¶12:
 * "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)".
 */
const UTC_LITERALS: readonly string[] = ["UTC", "GMT"];

/**
 * Read an EDI date/time value against its format code: the one place that knows code → grammar →
 * fields for UNTDID 2379 and X12 1250.
 *
 * - The value is tested against the code's grammar (`ediGrammar.ts`), its digits are read into a
 *   field bag, and the bag goes through `Temporal.PlainDate.from` / `PlainTime.from` /
 *   `PlainDateTime.from` with `overflow: "reject"`: the grammar proves shape, Temporal proves the
 *   date is real.
 * - A two-digit year resolves in the caller's `options.yearWindow` (`readYearWindowStart`); with
 *   no valid window, a code whose mask has `YY` returns null. A code with a four-digit year never
 *   reads the option.
 * - Every date-time code returns `local`, the wall clock as written, built by Temporal from the
 *   validated fields. A value with an offset (`205`–`208`; `3xx` whose `ZZZ` is `[+-]HH`, `UTC`
 *   or `GMT`) adds `offset` and `instant`: `local` and the offset are joined as an extended ISO
 *   string and handed to `toOffsetInstant`; no offset digit is sliced by hand. A `209` or `404`
 *   value has no date, so its offset is returned as `offset` beside `time`, with no instant (an
 *   instant needs a date). A `ZZZ` of any other three upper-case letters is returned as `zone`
 *   text beside `local` or `time`; the grammar admits nothing else.
 * - `406` returns `offset` alone, normalised to `±HH:MM` through `internal/utcOffsetString`.
 * - `TC` returns `{ dayOfYear }`; `EH` returns `{ yearDigit, dayOfYear }` and resolves nothing;
 *   `TU` (`YYDDD`, "Date Expressed in Format YYDDD") returns `{ date, dayOfYear }`: the day is
 *   checked against the year's length (`daysInYear`) and the date is that year's first day plus
 *   the days before it, built by Temporal.
 * - A period or range returns the start's members plus `periodEnd`. When both halves carry a
 *   date, an end that precedes its start returns null (**GMT rule**: a reversed period names no
 *   span of time, as the range validators hold). A date compared with a date-time (`DDT`, `DTD`)
 *   is compared by calendar date, since X12 gives the date no time of day.
 * - A time-only range (`RTM`, `HHMM-HHMM`) is returned as written, whatever the order of its
 *   times (**GMT rule**): it carries no date, so `2200-0600` is a window that crosses midnight,
 *   not a reversed one, and the reader does not say which day either time falls on. `RTM` is the
 *   only such code: UNTDID 2379's time-only periods (`210`, `501`–`503`) are not read, and every
 *   2379 period that is read (`713`, `717`–`719`) carries a date in both halves.
 * - Never throws: any failure, including a clock that cannot be read for a rolling window, is
 *   null.
 *
 * @param standard which element the code belongs to
 * @param code the 2379 or 1250 format code
 * @param value the element value, after the interchange has been unescaped
 * @param options the caller's `TwoDigitYearOptions` bag, already accepted by `isOptionsArgument`
 * @returns the fields the value states, or null
 *
 * @example readEdiDateTime("edifact", "203", "202406151430") // { local: "2024-06-15T14:30:00" }
 * @example readEdiDateTime("edifact", "303", "202406151430+02") // { local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }
 * @example readEdiDateTime("edifact", "303", "202406151430CET") // { local: "2024-06-15T14:30:00", zone: "CET" }
 * @example readEdiDateTime("edifact", "101", "240615", { yearWindow: 2000 }) // { date: "2024-06-15" }
 * @example readEdiDateTime("edifact", "101", "240615") // null (two-digit year, no window)
 * @example readEdiDateTime("x12", "RD8", "20240615-20240620") // { date: "2024-06-15", periodEnd: { date: "2024-06-20" } }
 * @example readEdiDateTime("x12", "RD8", "20240620-20240615") // null (the end precedes the start)
 * @example readEdiDateTime("x12", "RTM", "2200-0600") // { time: "22:00:00", periodEnd: { time: "06:00:00" } } (crosses midnight)
 * @example readEdiDateTime("x12", "UN", "20240615") // null
 */
export function readEdiDateTime(
  standard: EdiStandard,
  code: string,
  value: string,
  options?: unknown,
): EdiDateTime | null {
  try {
    const entry = ediCodeOf(standard, code);
    if (entry === null || typeof value !== "string") {
      return null;
    }
    const match = entry.grammar.exec(value);
    if (match === null) {
      return null;
    }
    const bags = readBags(entry.layout, match.slice(1));

    // The window is read only when a half carries a two-digit year, so a four-digit code never
    // reads the option and a rolling window never reads the clock for nothing.
    const needsWindow = bags.some((bag) => bag.yy !== undefined);
    const windowStart = needsWindow ? readYearWindowStart(options) : null;
    if (needsWindow && windowStart === null) {
      return null;
    }

    return combineHalves(bags.map((bag) => readHalf(bag, windowStart)));
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
 * - Null for a non-string, a value of any other length or shape, hour 24, and minute or second
 *   60. Never throws.
 *
 * @param value the element 337 value as transmitted
 * @returns the time, or null
 *
 * @example readX12Time("1430") // "14:30:00"
 * @example readX12Time("143045") // "14:30:45"
 * @example readX12Time("14300012") // "14:30:00.12"
 * @example readX12Time("2430") // null
 */
export function readX12Time(value: string): string | null {
  try {
    if (typeof value !== "string") {
      return null;
    }
    const match = X12_TIME_GRAMMAR.exec(value);
    if (match === null) {
      return null;
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
    return null;
  }
}

/** The grammar's captures as one field bag per half: one for a single value, two for a range. */
function readBags(layout: EdiLayout, captures: string[]): EdiFieldBag[] {
  const startBag = readBag(
    layout.start,
    captures.slice(0, layout.start.length),
  );
  return layout.end === undefined
    ? [startBag]
    : [startBag, readBag(layout.end, captures.slice(layout.start.length))];
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
  return withZoneText(bag, text);
}

/** The bag with its offset (`ZS`, `ZH` and `ZM` as `±HH:MM`) or its raw `ZZZ`, when the half has one. */
function withZoneText(
  bag: EdiFieldBag,
  text: Partial<Record<EdiPart, string>>,
): EdiFieldBag {
  if (text.ZS !== undefined) {
    return { ...bag, offset: `${text.ZS}${text.ZH}:${text.ZM}` };
  }
  return text.ZZZ === undefined ? bag : { ...bag, zone: text.ZZZ };
}

/**
 * The halves as one result: the start alone for a single value, the start with `periodEnd` for a
 * period or range. Null when either half is null, or when a dated end precedes its start.
 */
function combineHalves(
  halves: readonly (EdiDateTime | null)[],
): EdiDateTime | null {
  const [start, end] = halves;
  if (start === null || start === undefined || end === undefined) {
    return start ?? null;
  }
  if (end === null || endPrecedesStart(start, end)) {
    return null;
  }
  return { ...start, periodEnd: end };
}

/** One half of a value as the members it can state, or null when it states none. Temporal throws for a date or time that is not real. */
function readHalf(
  bag: EdiFieldBag,
  windowStart: number | null,
): EdiDateTime | null {
  const year = yearOf(bag, windowStart);
  if (bag.dayOfYear !== undefined) {
    return readOrdinal(bag, year);
  }
  const hasDate = bag.month !== undefined;
  const hasTime = bag.hour !== undefined;
  if (hasDate && hasTime) {
    return readDateTime(bag, year);
  }
  if (hasDate) {
    return readDate(bag, year);
  }
  if (hasTime) {
    return readTime(bag);
  }
  // 406: the offset alone.
  return bag.offset === undefined ? null : offsetOnly(bag.offset);
}

/** The half's year: a two-digit year placed in the caller's window, or the four digits as read. */
function yearOf(
  bag: EdiFieldBag,
  windowStart: number | null,
): number | undefined {
  return bag.yy !== undefined && windowStart !== null
    ? twoDigitYear(bag.yy, windowStart)
    : bag.year;
}

/** A date and a time: `local`, with `offset` and `instant` when the half states an offset, or `zone` when it names one. */
function readDateTime(
  bag: EdiFieldBag,
  year: number | undefined,
): EdiDateTime | null {
  const local = Temporal.PlainDateTime.from(
    {
      year,
      month: bag.month,
      day: bag.day,
      hour: bag.hour,
      minute: bag.minute,
      second: bag.second ?? 0,
    },
    { overflow: "reject" },
  ).toString();
  return withZone({ local }, local, bag);
}

/** A date alone: `date`, never `local`, since a date names no instant. */
function readDate(bag: EdiFieldBag, year: number | undefined): EdiDateTime {
  return {
    date: Temporal.PlainDate.from(
      { year, month: bag.month, day: bag.day },
      { overflow: "reject" },
    ).toString(),
  };
}

/** A time alone: `time`, with `offset` for `209`, and with `offset` or `zone` for `404`. */
function readTime(bag: EdiFieldBag): EdiDateTime | null {
  const time = Temporal.PlainTime.from(
    { hour: bag.hour, minute: bag.minute, second: bag.second ?? 0 },
    { overflow: "reject" },
  ).toString();
  return withZone({ time }, null, bag);
}

/**
 * `TC` `{ dayOfYear }`; `EH` `{ yearDigit, dayOfYear }`; `TU` `{ date, dayOfYear }`. X12 1250
 * calls `TU` "Date Expressed in Format YYDDD": a year and a day of the year name one date, so
 * the date is returned. It is the year's first day plus the days before the named one, built by
 * Temporal, after the day is checked against the year's own length (`daysInYear`).
 */
function readOrdinal(
  bag: EdiFieldBag,
  year: number | undefined,
): EdiDateTime | null {
  const dayOfYear = bag.dayOfYear as number;
  if (bag.yearDigit !== undefined) {
    return { yearDigit: bag.yearDigit, dayOfYear };
  }
  if (year === undefined) {
    return { dayOfYear };
  }
  const firstDay = Temporal.PlainDate.from(
    { year, month: 1, day: 1 },
    { overflow: "reject" },
  );
  if (dayOfYear > firstDay.daysInYear) {
    return null;
  }
  return { date: firstDay.add({ days: dayOfYear - 1 }).toString(), dayOfYear };
}

/** `{ offset }` normalised to `±HH:MM` through Temporal, never by slicing. */
function offsetOnly(offset: string): EdiDateTime | null {
  const nanoseconds = parseUtcOffsetNanoseconds(offset);
  if (nanoseconds === null) {
    return null;
  }
  const normalised = formatUtcOffset(nanoseconds);
  return normalised === null ? null : { offset: normalised };
}

/**
 * Attach what the value says about its zone. `ZHHMM` (205–209) and a `ZZZ` of `[+-]HH`, `UTC` or
 * `GMT` resolve to an offset: with a wall clock that is `offset` and `instant` beside `local`,
 * through `toOffsetInstant`; with a time alone (209, 404) it is `offset` beside `time`. A `ZZZ`
 * of any other three letters is `zone` text. `base` always stays: the wall clock as written.
 */
function withZone(
  base: EdiDateTime,
  local: string | null,
  bag: EdiFieldBag,
): EdiDateTime | null {
  const offset = zoneOffset(bag);
  if (offset === null) {
    return bag.zone === undefined ? base : { ...base, zone: bag.zone };
  }
  if (local === null) {
    const normalised = offsetOnly(offset);
    return normalised === null ? null : { ...base, ...normalised };
  }
  const pair = toOffsetInstant(`${local}${offset}`);
  return pair === null
    ? null
    : { ...base, offset: pair.offset, instant: pair.instant };
}

/** The `±HH:MM` an offset-bearing half states, or null when it states a zone or nothing. */
function zoneOffset(bag: EdiFieldBag): string | null {
  if (bag.offset !== undefined) {
    return bag.offset;
  }
  if (bag.zone === undefined) {
    return null;
  }
  if (UTC_LITERALS.includes(bag.zone)) {
    return "+00:00";
  }
  return HOURS_ONLY_OFFSET.test(bag.zone) ? `${bag.zone}:00` : null;
}

/**
 * GMT rule: a reversed period names no span of time, when both halves carry a date. Two
 * date-times compare to the second; a date beside a date-time (`DDT`, `DTD`) compares by calendar
 * date. A time-only range (`RTM`) has no date to compare, so an end before its start is a window
 * that crosses midnight and is never reversed.
 */
function endPrecedesStart(start: EdiDateTime, end: EdiPeriodEnd): boolean {
  const startDate = dateOf(start);
  const endDate = dateOf(end);
  if (startDate === null || endDate === null) {
    return false;
  }
  if (start.local !== undefined && end.local !== undefined) {
    return Temporal.PlainDateTime.compare(end.local, start.local) < 0;
  }
  return Temporal.PlainDate.compare(endDate, startDate) < 0;
}

/** The calendar date a half carries, from `date` or `local`, or null for a half with no date. */
function dateOf(half: EdiPeriodEnd): Temporal.PlainDate | null {
  if (half.date !== undefined) {
    return Temporal.PlainDate.from(half.date);
  }
  return half.local === undefined
    ? null
    : Temporal.PlainDateTime.from(half.local).toPlainDate();
}
